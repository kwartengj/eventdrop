import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiException implements Exception {
  ApiException(this.message, this.status);
  final String message;
  final int status;
  @override
  String toString() => message;
}

String sha256Bytes(List<int> bytes) => sha256.convert(bytes).toString();

String normalizeCode(String value) => value.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

class EventDropApi {
  EventDropApi({
    this.baseUrl = const String.fromEnvironment('API_BASE', defaultValue: 'http://localhost:3000'),
    http.Client? client,
    this.persist = true,
  }) : _client = client ?? http.Client();

  final String baseUrl;
  final bool persist;
  final http.Client _client;
  String? hostToken;
  String? guestToken;

  Future<void> restore() async {
    if (!persist) return;
    final prefs = await SharedPreferences.getInstance();
    hostToken = prefs.getString('hostToken');
    guestToken = prefs.getString('guestToken');
  }

  Future<void> _save() async {
    if (!persist) return;
    final prefs = await SharedPreferences.getInstance();
    if (hostToken == null) {
      await prefs.remove('hostToken');
    } else {
      await prefs.setString('hostToken', hostToken!);
    }
    if (guestToken == null) {
      await prefs.remove('guestToken');
    } else {
      await prefs.setString('guestToken', guestToken!);
    }
  }

  Future<Map<String, dynamic>> send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool guest = false,
    Map<String, String>? query,
  }) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final headers = <String, String>{'Content-Type': 'application/json'};
    final token = guest ? guestToken : hostToken;
    if (token != null) headers['Authorization'] = 'Bearer $token';
    if (guest) headers['X-EventDrop-View'] = 'guest';
    final response = await _client.send(
      http.Request(method, uri)
        ..headers.addAll(headers)
        ..body = body == null ? '' : jsonEncode(body),
    );
    final text = await response.stream.bytesToString();
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw ApiException(decoded['error']?.toString() ?? 'Request failed', response.statusCode);
    }
    return decoded;
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final data = await send('POST', '/api/auth/login', body: {'email': email, 'password': password});
    hostToken = data['token'] as String?;
    await _save();
    return data;
  }

  Future<Map<String, dynamic>> preview(String code) {
    return send('GET', '/api/join/${normalizeCode(code)}', guest: true);
  }

  Future<Map<String, dynamic>> join(String code, {String? displayName, String? message}) async {
    final data = await send('POST', '/api/join/${normalizeCode(code)}', guest: true, body: {
      if (displayName != null && displayName.trim().isNotEmpty) 'displayName': displayName.trim(),
      if (message != null && message.trim().isNotEmpty) 'message': message.trim(),
    });
    final token = data['token'] as String?;
    if (token != null) guestToken = token;
    await _save();
    return data;
  }

  Future<Map<String, dynamic>> createEvent(Map<String, dynamic> body) {
    return send('POST', '/api/events', body: body);
  }

  Future<Map<String, dynamic>> event(String id) => send('GET', '/api/events/$id');

  Future<List<dynamic>> media(String eventId, {bool guest = false}) async {
    final data = await send('GET', '/api/events/$eventId/media', guest: guest);
    return data['items'] as List<dynamic>? ?? [];
  }

  Future<void> uploadBytes({
    required String eventId,
    required String fileName,
    required String mimeType,
    required Uint8List bytes,
    bool guest = true,
  }) async {
    final presign = await send('POST', '/api/uploads/presign', guest: guest, body: {
      'eventId': eventId,
      'fileName': fileName,
      'mimeType': mimeType,
      'fileSize': bytes.length,
      'fileHash': sha256Bytes(bytes),
    });
    if (presign['duplicate'] == true) return;
    final headers = Map<String, String>.from((presign['headers'] as Map).map((key, value) => MapEntry(key.toString(), value.toString())));
    final put = http.Request('PUT', Uri.parse(presign['url'] as String))
      ..headers.addAll(headers)
      ..bodyBytes = bytes;
    http.StreamedResponse stored;
    try {
      stored = await _client.send(put);
    } catch (_) {
      throw ApiException(
        'This phone could not reach photo storage. Use the same Wi-Fi as the computer, and leave port 9000 open.',
        0,
      );
    }
    if (stored.statusCode >= 300) {
      throw ApiException('Storage rejected the file', stored.statusCode);
    }
    await send('POST', '/api/uploads/complete', guest: guest, body: {'uploadId': presign['uploadId']});
  }
}
