import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../api.dart';

class HostLoginScreen extends StatefulWidget {
  const HostLoginScreen({super.key, required this.api});

  final EventDropApi api;

  @override
  State<HostLoginScreen> createState() => _HostLoginScreenState();
}

class _HostLoginScreenState extends State<HostLoginScreen> {
  final email = TextEditingController(text: 'host@eventdrop.app');
  final password = TextEditingController();
  String? error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Host sign in')),
      body: ListView(
        padding: const EdgeInsets.all(22),
        children: [
          const Text('Sign in', style: TextStyle(fontSize: 36, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextField(controller: email, decoration: const InputDecoration(labelText: 'Email')),
          const SizedBox(height: 12),
          TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () async {
              try {
                await widget.api.login(email.text, password.text);
                if (!context.mounted) return;
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => HostCreateScreen(api: widget.api)));
              } catch (err) {
                setState(() => error = err.toString());
              }
            },
            child: const Text('Sign in'),
          ),
          if (error != null) Text(error!),
          const SizedBox(height: 8),
          const Text('Demo host: host@eventdrop.app / demo-host-1234'),
        ],
      ),
    );
  }
}

class HostCreateScreen extends StatefulWidget {
  const HostCreateScreen({super.key, required this.api});

  final EventDropApi api;

  @override
  State<HostCreateScreen> createState() => _HostCreateScreenState();
}

class _HostCreateScreenState extends State<HostCreateScreen> {
  final name = TextEditingController();
  final hostName = TextEditingController();
  String? error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create event')),
      body: ListView(
        padding: const EdgeInsets.all(22),
        children: [
          const Text('Create event', style: TextStyle(fontSize: 36, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Event name')),
          const SizedBox(height: 12),
          TextField(controller: hostName, decoration: const InputDecoration(labelText: 'Your name')),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () async {
              try {
                final data = await widget.api.createEvent({
                  'name': name.text,
                  'hostName': hostName.text,
                  'privacy': 'link',
                  'videosAllowed': true,
                });
                if (!context.mounted) return;
                Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => HostShareScreen(api: widget.api, event: data['event'] as Map<String, dynamic>),
                ));
              } catch (err) {
                setState(() => error = err.toString());
              }
            },
            child: const Text('Create event'),
          ),
          if (error != null) Text(error!),
        ],
      ),
    );
  }
}

class HostShareScreen extends StatelessWidget {
  const HostShareScreen({super.key, required this.api, required this.event});

  final EventDropApi api;
  final Map<String, dynamic> event;

  @override
  Widget build(BuildContext context) {
    final url = event['joinUrl'] as String? ?? '';
    final code = event['joinCode'] as String? ?? '';
    return Scaffold(
      appBar: AppBar(title: const Text('Share')),
      body: ListView(
        padding: const EdgeInsets.all(22),
        children: [
          Text(event['name']?.toString() ?? '', style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          Center(child: QrImageView(data: url, size: 220, backgroundColor: Colors.white)),
          const SizedBox(height: 12),
          Text(code, textAlign: TextAlign.center, style: const TextStyle(fontFamily: 'Courier', fontSize: 36, letterSpacing: 4)),
          const SizedBox(height: 8),
          Text(url, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => HostDashboardScreen(api: api, eventId: event['id'] as String, title: event['name']?.toString() ?? 'Event'),
              ));
            },
            child: const Text('Open dashboard'),
          ),
        ],
      ),
    );
  }
}

class HostDashboardScreen extends StatefulWidget {
  const HostDashboardScreen({super.key, required this.api, required this.eventId, required this.title});

  final EventDropApi api;
  final String eventId;
  final String title;

  @override
  State<HostDashboardScreen> createState() => _HostDashboardScreenState();
}

class _HostDashboardScreenState extends State<HostDashboardScreen> {
  Map<String, dynamic>? event;
  List<dynamic> items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final loaded = await widget.api.event(widget.eventId);
    final media = await widget.api.media(widget.eventId);
    if (!mounted) return;
    setState(() {
      event = loaded['event'] as Map<String, dynamic>;
      items = media;
    });
  }

  @override
  Widget build(BuildContext context) {
    final counts = event?['counts'] as Map<String, dynamic>?;
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(counts == null ? 'Loading…' : '${counts['photos']} photos · ${counts['videos']} videos · ${counts['contributors']} contributors'),
          ),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(12),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 8, mainAxisSpacing: 8),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index] as Map<String, dynamic>;
                final thumb = item['thumbUrl'] as String?;
                return ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: thumb == null ? const ColoredBox(color: Color(0xFFD9CFC2)) : Image.network(thumb, fit: BoxFit.cover),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
