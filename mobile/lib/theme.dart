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
      fillColor: dark ? const Color(0xFF2A241E) : const Color(0xFFF6F1EA),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: coral,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(58),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
      ),
    ),
  );
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
