import 'package:flutter/material.dart';

const paper = Color(0xFFF5EFE6);
const paperDark = Color(0xFF16120E);
const ink = Color(0xFF231D17);
const inkDark = Color(0xFFF3ECE2);
const muted = Color(0xFF6F655B);
const card = Color(0xFFFFFCF7);
const cardDark = Color(0xFF211B16);
const coral = Color(0xFFD2603F);

ThemeData eventDropTheme({required Brightness brightness}) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: coral,
    onPrimary: Colors.white,
    secondary: dark ? inkDark : ink,
    onSecondary: dark ? paperDark : paper,
    surface: dark ? cardDark : card,
    onSurface: dark ? inkDark : ink,
    error: const Color(0xFF8C3A2F),
    onError: Colors.white,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? paperDark : paper,
    fontFamily: 'Helvetica Neue',
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? paperDark : paper,
      foregroundColor: dark ? inkDark : ink,
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF2A241E) : card,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: dark ? const Color(0x22F3ECE2) : const Color(0x33231D17)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: coral, width: 1.6),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: coral,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        side: BorderSide(color: dark ? const Color(0x33F3ECE2) : const Color(0x33231D17)),
        foregroundColor: dark ? inkDark : ink,
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    cardTheme: CardThemeData(
      color: dark ? cardDark : card,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
  );
}

/// Keeps phone layouts full-bleed and centers a readable column on tablets and wide windows.
Widget adaptiveBody(Widget child, {double maxWidth = 640}) {
  return Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: child,
    ),
  );
}

double widthPad(BuildContext context) {
  final width = MediaQuery.sizeOf(context).width;
  if (width < 380) return 16;
  if (width > 840) return 28;
  return 22;
}

int gridCount(double width, {double tile = 180}) {
  final count = (width / tile).floor();
  if (count < 2) return 2;
  if (count > 6) return 6;
  return count;
}

class Brand extends StatelessWidget {
  const Brand({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        DecoratedBox(
          decoration: BoxDecoration(color: coral, shape: BoxShape.circle),
          child: SizedBox(width: 10, height: 10),
        ),
        SizedBox(width: 8),
        Text('EventDrop', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      ],
    );
  }
}
