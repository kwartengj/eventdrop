import 'package:flutter/material.dart';

import 'api.dart';
import 'screens/guest.dart';
import 'theme.dart';

class EventDropApp extends StatefulWidget {
  const EventDropApp({super.key, required this.api, this.dark = false});

  final EventDropApi api;
  final bool dark;

  @override
  State<EventDropApp> createState() => _EventDropAppState();
}

class _EventDropAppState extends State<EventDropApp> {
  late bool dark = widget.dark;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EventDrop',
      theme: eventDropTheme(brightness: Brightness.light),
      darkTheme: eventDropTheme(brightness: Brightness.dark),
      themeMode: dark ? ThemeMode.dark : ThemeMode.light,
      home: CodeScreen(
        api: widget.api,
        onToggleTheme: () => setState(() => dark = !dark),
      ),
    );
  }
}

void main() {
  final api = EventDropApi();
  runApp(EventDropApp(api: api));
}
