import 'dart:convert';

import 'package:eventdrop/api.dart';
import 'package:eventdrop/main.dart';
import 'package:eventdrop/screens/guest.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('hashes bytes and normalizes codes', () {
    expect(sha256Bytes(utf8.encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(normalizeCode(' ab-c123 '), 'ABC123');
  });

  testWidgets('code screen shows the tagline and continue', (tester) async {
    final api = EventDropApi(persist: false, client: MockClient((request) async => http.Response('{}', 200)));
    await tester.pumpWidget(EventDropApp(api: api));
    expect(find.text("One event. Everyone's photos. One place."), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
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
    expect(find.text('Add Photos'), findsOneWidget);
  });

  testWidgets('upload screen has the primary and camera actions', (tester) async {
    final api = EventDropApi(persist: false);
    await tester.pumpWidget(MaterialApp(
      home: UploadScreen(api: api, eventId: 'evt', title: 'Wedding', code: 'ABC123'),
    ));
    expect(find.text('Add Photos & Videos'), findsOneWidget);
    expect(find.text('Shoot & drop'), findsOneWidget);
  });
}
