import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../theme.dart';
import 'host.dart';

class CodeScreen extends StatefulWidget {
  const CodeScreen({super.key, required this.api, this.onToggleTheme});

  final EventDropApi api;
  final VoidCallback? onToggleTheme;

  @override
  State<CodeScreen> createState() => _CodeScreenState();
}

class _CodeScreenState extends State<CodeScreen> {
  final code = TextEditingController();
  String? error;

  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: adaptiveBody(
          ListView(
          padding: EdgeInsets.fromLTRB(widthPad(context), 16, widthPad(context), 28),
          children: [
            Row(children: [
              const Brand(),
              const Spacer(),
              TextButton(onPressed: widget.onToggleTheme, child: const Text('Theme')),
            ]),
            const SizedBox(height: 48),
            const Text('Join an event', style: TextStyle(fontSize: 36, height: 1.05, fontWeight: FontWeight.w700, letterSpacing: -0.6)),
            const SizedBox(height: 10),
            const Text("Enter the 6-character code from the invite or poster."),
            const SizedBox(height: 4),
            const Text("One event. Everyone's photos. One place.", style: TextStyle(fontSize: 13)),
            const SizedBox(height: 22),
            TextField(
              controller: code,
              textCapitalization: TextCapitalization.characters,
              textAlign: TextAlign.center,
              style: TextStyle(fontFamily: 'Courier', fontSize: MediaQuery.sizeOf(context).width < 380 ? 22 : 28, letterSpacing: MediaQuery.sizeOf(context).width < 380 ? 3 : 6),
              decoration: const InputDecoration(hintText: 'ABC123'),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () {
                final next = normalizeCode(code.text);
                if (next.length < 6) {
                  setState(() => error = 'Enter the 6-character code');
                  return;
                }
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => LandingScreen(api: widget.api, code: next)));
              },
              child: const Text('Join event'),
            ),
            if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: const TextStyle(color: Color(0xFF8C3A2F)))),
            TextButton(
              onPressed: () {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => HostLoginScreen(api: widget.api)));
              },
              child: const Text('Hosting? Sign in'),
            ),
          ],
        ),
        ),
      ),
    );
  }
}

class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key, required this.api, required this.code});

  final EventDropApi api;
  final String code;

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  Map<String, dynamic>? event;
  final name = TextEditingController();
  String? error;

  @override
  void initState() {
    super.initState();
    widget.api.preview(widget.code).then((data) {
      if (!mounted) return;
      setState(() => event = data['event'] as Map<String, dynamic>);
    }).catchError((err) {
      if (!mounted) return;
      setState(() => error = err.toString());
    });
  }

  Future<void> enter(String next) async {
    try {
      final joined = await widget.api.join(widget.code, displayName: name.text);
      final id = (joined['event'] as Map<String, dynamic>)['id'] as String;
      if (!mounted) return;
      final title = (joined['event'] as Map<String, dynamic>)['name'] as String? ?? 'Event';
      if (next == 'upload') {
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => UploadScreen(api: widget.api, eventId: id, title: title, code: widget.code)));
      } else {
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => GalleryScreen(api: widget.api, eventId: id, title: title, code: widget.code)));
      }
    } catch (err) {
      setState(() => error = err.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = event;
    return Scaffold(
      appBar: AppBar(title: const Brand()),
      body: current == null
          ? Center(child: Text(error ?? 'Finding the event…'))
          : adaptiveBody(
              ListView(
              padding: EdgeInsets.fromLTRB(widthPad(context), 8, widthPad(context), 28),
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: current['coverUrl'] != null
                      ? Image.network(current['coverUrl'] as String, height: 180, width: double.infinity, fit: BoxFit.cover)
                      : Container(height: 180, color: const Color(0xFFD9CFC2), alignment: Alignment.center, child: Text((current['name'] as String).characters.first, style: const TextStyle(fontSize: 42, fontWeight: FontWeight.w700))),
                ),
                const SizedBox(height: 16),
                Text(current['name'] as String? ?? '', style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w700, height: 1)),
                const SizedBox(height: 8),
                Text(current['hostName']?.toString() ?? ''),
                const SizedBox(height: 16),
                TextField(controller: name, decoration: const InputDecoration(labelText: 'Your name (optional)')),
                const SizedBox(height: 12),
                FilledButton(onPressed: current['uploadsOpen'] == false ? null : () => enter('upload'), child: const Text('Join & add photos')),
                const SizedBox(height: 8),
                OutlinedButton(onPressed: () => enter('gallery'), child: const Text('Browse gallery')),
                if (error != null) Text(error!),
              ],
            ),
            ),
    );
  }
}

class UploadScreen extends StatefulWidget {
  const UploadScreen({super.key, required this.api, required this.eventId, required this.title, required this.code});

  final EventDropApi api;
  final String eventId;
  final String title;
  final String code;

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

String guessMime(XFile file, Uint8List bytes) {
  final given = file.mimeType?.toLowerCase() ?? '';
  if (given.isNotEmpty && given != 'application/octet-stream') {
    if (given == 'image/jpg' || given == 'image/pjpeg') return 'image/jpeg';
    if (given == 'image/heif') return 'image/heic';
    return given;
  }
  if (bytes.length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return 'image/jpeg';
  if (bytes.length >= 4 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return 'image/png';
  if (bytes.length >= 4 && bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46) return 'image/gif';
  if (bytes.length >= 12) {
    final box = String.fromCharCodes(bytes.sublist(4, 8));
    if (box == 'ftyp') {
      final brand = String.fromCharCodes(bytes.sublist(8, 12)).toLowerCase();
      if (brand.startsWith('hei') || brand.startsWith('mif') || brand.startsWith('msf')) return 'image/heic';
      if (brand.startsWith('qt')) return 'video/quicktime';
      return 'video/mp4';
    }
  }
  final name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.mp4') || name.endsWith('.m4v')) return 'video/mp4';
  return 'image/jpeg';
}

class _UploadItem {
  _UploadItem(this.name, this.bytes, this.mime);
  final String name;
  final Uint8List bytes;
  final String mime;
  String status = 'queued';
  String? error;
}

class _UploadScreenState extends State<UploadScreen> {
  final picker = ImagePicker();
  final items = <_UploadItem>[];
  bool reviewing = false;

  Future<void> add(List<XFile> files) async {
    final incoming = <_UploadItem>[];
    for (final file in files) {
      final bytes = await file.readAsBytes();
      incoming.add(_UploadItem(file.name.isEmpty ? 'photo' : file.name, bytes, guessMime(file, bytes)));
    }
    if (!mounted) return;
    setState(() {
      reviewing = true;
      for (final item in incoming) {
        item.status = 'review';
      }
      items.addAll(incoming);
    });
  }

  Future<void> _pump() async {
    final pending = items.where((item) => item.status == 'queued').toList();
    for (final item in pending) {
      setState(() => item.status = 'uploading');
      try {
        await widget.api.uploadBytes(eventId: widget.eventId, fileName: item.name, mimeType: item.mime, bytes: item.bytes);
        if (mounted) {
          setState(() => item.status = 'done');
        }
      } catch (err) {
        if (mounted) {
          setState(() {
            item.status = 'error';
            item.error = err.toString();
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final done = items.isNotEmpty && items.every((item) => item.status == 'done' || item.status == 'error');
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: adaptiveBody(
        ListView(
        padding: EdgeInsets.fromLTRB(widthPad(context), 12, widthPad(context), 28),
        children: [
          const Text('Add photos', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          if (!done)
            FilledButton(
              onPressed: () async {
                final files = await picker.pickMultipleMedia();
                if (files.isNotEmpty) await add(files);
              },
              child: const Text('Add photos & videos'),
            ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () async {
              final file = await picker.pickImage(source: ImageSource.camera);
              if (file != null) {
                await add([file]);
              }
            },
            child: const Text('Take a photo'),
          ),
          if (reviewing) ...[
            const SizedBox(height: 12),
            Text('${items.where((item) => item.status == 'review').length} selected'),
            FilledButton(
              onPressed: () {
                setState(() {
                  for (final item in items) {
                    if (item.status == 'review') item.status = 'queued';
                  }
                  reviewing = false;
                });
                _pump();
              },
              child: const Text('Upload selection'),
            ),
          ],
          const SizedBox(height: 12),
          for (final item in items)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: item.mime.startsWith('image/')
                    ? Image.memory(item.bytes, width: 56, height: 56, fit: BoxFit.cover)
                    : const SizedBox(width: 56, height: 56, child: Icon(Icons.movie_outlined)),
              ),
              title: Text(item.name),
              subtitle: Text(item.error ?? (item.status == 'done' ? 'Uploaded' : item.status == 'uploading' ? 'Uploading' : item.status)),
            ),
          if (done)
            FilledButton(
              onPressed: () {
                Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => GalleryScreen(api: widget.api, eventId: widget.eventId, title: widget.title, code: widget.code),
                ));
              },
              child: const Text('View gallery'),
            ),
        ],
        ),
      ),
    );
  }
}

class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key, required this.api, required this.eventId, required this.title, required this.code});

  final EventDropApi api;
  final String eventId;
  final String title;
  final String code;

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  List<dynamic> items = [];
  String? toast;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final next = await widget.api.media(widget.eventId, guest: true);
    if (!mounted) return;
    setState(() => items = next);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => UploadScreen(api: widget.api, eventId: widget.eventId, title: widget.title, code: widget.code),
          ));
        },
        backgroundColor: coral,
        label: const Text('Add Photos'),
      ),
      body: items.isEmpty
          ? const Center(child: Text('No photos yet.'))
          : adaptiveBody(
              GridView.builder(
              padding: const EdgeInsets.all(12),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: gridCount(MediaQuery.sizeOf(context).width),
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index] as Map<String, dynamic>;
                final thumb = item['thumbUrl'] as String?;
                return GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => ViewerScreen(items: items.cast<Map<String, dynamic>>(), index: index),
                    ));
                  },
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: thumb == null ? const ColoredBox(color: Color(0xFFD9CFC2)) : Image.network(thumb, fit: BoxFit.cover),
                  ),
                );
              },
            ),
            ),
    );
  }
}

class ViewerScreen extends StatefulWidget {
  const ViewerScreen({super.key, required this.items, required this.index});

  final List<Map<String, dynamic>> items;
  final int index;

  @override
  State<ViewerScreen> createState() => _ViewerScreenState();
}

class _ViewerScreenState extends State<ViewerScreen> {
  late final controller = PageController(initialPage: widget.index);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF100E0C),
      appBar: AppBar(backgroundColor: const Color(0xFF100E0C), foregroundColor: const Color(0xFFF3EDE4)),
      body: PageView.builder(
        controller: controller,
        itemCount: widget.items.length,
        itemBuilder: (context, index) {
          final item = widget.items[index];
          final url = item['url'] as String?;
          final video = (item['mimeType'] as String?)?.startsWith('video/') ?? false;
          if (url == null) return const SizedBox.shrink();
          if (video) {
            return Center(child: Text('Video\n${item['fileName']}', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)));
          }
          return InteractiveViewer(child: Image.network(url));
        },
      ),
    );
  }
}
