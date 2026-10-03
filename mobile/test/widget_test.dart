import 'dart:convert';

import 'package:eventdrop/api.dart';
import 'package:eventdrop/main.dart';
import 'package:eventdrop/screens/guest.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('join urls keep the server origin', () {
    expect(resolveApi('192.168.1.170:3000', '/api/join/ABC123').toString(), 'http://192.168.1.170:3000/api/join/ABC123');
    expect(
      resolveApi('http://192.168.1.170:3000/api/join/G8QHLP', '/api/join/ABC123').toString(),
      'http://192.168.1.170:3000/api/join/ABC123',
    );
    expect(resolveApi('http://192.168.1.170:3000/', '/api/join/ABC123').toString(), 'http://192.168.1.170:3000/api/join/ABC123');
  });

  test('hashes bytes and normalizes codes', () {
    expect(sha256Bytes(utf8.encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(normalizeCode(' ab-c123 '), 'ABC123');
  });

  test('a web page from the server is reported as the wrong address', () async {
    final api = EventDropApi(
      baseUrl: 'http://192.168.1.170:3000',
      persist: false,
      client: MockClient((request) async => http.Response('<!DOCTYPE html><html></html>', 200)),
    );
    expect(
      api.preview('ABC123'),
      throwsA(isA<ApiException>().having((error) => error.message, 'message', contains('web page'))),
    );
  });

  testWidgets('code screen shows the tagline and continue', (tester) async {
    final api = EventDropApi(persist: false, client: MockClient((request) async => http.Response('{}', 200)));
    await tester.pumpWidget(EventDropApp(api: api));
    expect(find.text('Join an event'), findsOneWidget);
    expect(find.text("One event. Everyone's photos. One place."), findsOneWidget);
    expect(find.text('Join event'), findsOneWidget);
    expect(find.text('Hosting? Sign in'), findsOneWidget);
  });

  testWidgets('landing offers Add Photos', (tester) async {
    final api = EventDropApi(
      persist: false,
      client: MockClient((request) async {
        return http.Response(
          jsonEncode({
            'event': {
              'id': '11111111-1111-1111-1111-111111111111',
              'name': "Sarah & John's Wedding",
              'hostName': 'Sarah',
              'uploadsOpen': true,
              'coverUrl': null,
            },
            'joined': false,
          }),
          200,
        );
      }),
    );
    await tester.pumpWidget(MaterialApp(home: LandingScreen(api: api, code: 'ABC123')));
    await tester.pumpAndSettle();
    expect(find.text("Sarah & John's Wedding"), findsOneWidget);
    expect(find.text('Join & add photos'), findsOneWidget);
  });

  testWidgets('upload screen has the primary and camera actions', (tester) async {
    final api = EventDropApi(persist: false);
    await tester.pumpWidget(MaterialApp(
      home: UploadScreen(api: api, eventId: 'evt', title: 'Wedding', code: 'ABC123'),
    ));
    expect(find.text('Add photos & videos'), findsOneWidget);
    expect(find.text('Take a photo'), findsOneWidget);
  });
}
