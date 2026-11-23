// jay. — © 2026 Jay — https://ag0nyy-ops.github.io/ — source viewable, not reusable by others (LICENSE)
//
// Design tokens for SwiftUI (iOS 16+ / macOS 13+). Same values as tokens.css and tokens.json.
//
// Fonts: iOS can't load .woff2. Download the TTF/OTF files from the upstream projects listed in
// assets/fonts/README.md, add them to your app target, and list them under "Fonts provided by
// application" (UIAppFonts) in Info.plist. The names below are the PostScript names.

import SwiftUI

// MARK: - Colour (black and white only)

public extension Color {
    static let jayBg         = Color(hex: 0x060606)
    static let jayFg         = Color(hex: 0xECECEC)
    static let jayBg2        = Color(hex: 0x0C0C0C)   // cards, panels
    static let jayMuted      = Color(hex: 0xA7A7A7)   // secondary text
    static let jayLine       = Color(hex: 0x1D1D1D)   // hairlines
    static let jayLineStrong = Color(hex: 0x444444)   // borders, dividers
    static let jayFringeRed  = Color(hex: 0xFF7882)   // only for the faint title fringe
    static let jayFringeCyan = Color(hex: 0x7BDCFA)

    init(hex: UInt32) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: 1)
    }
}

// MARK: - Fonts

public enum JayFontName {
    public static let goth         = "UnifrakturMaguntia"
    public static let mono         = "IBMPlexMono-Regular"
    public static let monoSemiBold = "IBMPlexMono-SemiBold"
    public static let sans         = "IBMPlexSans-Regular"
}

public extension Font {
    /// Blackletter, for the name and big titles.
    static func jayGoth(_ size: CGFloat) -> Font { .custom(JayFontName.goth, size: size) }
    /// Mono, for labels, UI and prices.
    static func jayMono(_ size: CGFloat, semibold: Bool = false) -> Font {
        .custom(semibold ? JayFontName.monoSemiBold : JayFontName.mono, size: size)
    }
    /// Sans, for reading text (17pt is the site's body size).
    static func jaySans(_ size: CGFloat = 17) -> Font { .custom(JayFontName.sans, size: size) }
}

// MARK: - Spacing, shape, motion

public enum JaySpace {
    public static let s1: CGFloat = 4,  s2: CGFloat = 8,  s3: CGFloat = 12
    public static let s4: CGFloat = 16, s5: CGFloat = 24, s6: CGFloat = 32
    public static let s7: CGFloat = 48, s8: CGFloat = 64, s9: CGFloat = 96
}

public enum JayShape {
    public static let radius: CGFloat = 0          // sharp corners everywhere
    public static let border: CGFloat = 1
    public static let borderStrong: CGFloat = 2
}

public enum JayMotion {
    public static let fast = 0.25, base = 0.4, slow = 0.5
    /// "liquid": the glide used for most transitions.
    public static func liquid(_ duration: Double = JayMotion.base) -> Animation { .timingCurve(0.22, 1, 0.36, 1, duration: duration) }
    /// "ink": slow, fast, slow.
    public static func ink(_ duration: Double = JayMotion.base) -> Animation { .timingCurve(0.65, 0, 0.35, 1, duration: duration) }
    /// "spring": overshoots, then settles. An approximation of the site's CSS spring curve.
    public static let spring = Animation.spring(response: 0.5, dampingFraction: 0.55)
}

// MARK: - Small pieces

public extension View {
    /// Small uppercase mono label, like "FILE 01 / CASE FILES".
    func jayLabel() -> some View {
        self.font(.jayMono(12))
            .tracking(12 * 0.22)
            .textCase(.uppercase)
            .foregroundColor(.jayMuted)
    }

    /// A flat card: filled panel, 1pt strong border, no corner radius.
    func jayCard(padding: CGFloat = JaySpace.s5) -> some View {
        self.padding(padding)
            .background(Color.jayBg2)
            .overlay(Rectangle().stroke(Color.jayLineStrong, lineWidth: JayShape.border))
    }
}

/// Outlined button; `solid: true` is the primary (filled) one.
public struct JayButtonStyle: ButtonStyle {
    public var solid: Bool
    public init(solid: Bool = false) { self.solid = solid }

    public func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        let filled = solid != pressed          // pressing flips the fill, like the site's hover
        return configuration.label
            .font(.jayMono(12, semibold: true))
            .tracking(12 * 0.14)
            .textCase(.uppercase)
            .padding(.horizontal, 20).padding(.vertical, 14)
            .foregroundColor(filled ? .jayBg : .jayFg)
            .background(filled ? Color.jayFg : Color.clear)
            .overlay(Rectangle().stroke(Color.jayFg, lineWidth: JayShape.border))
            .animation(JayMotion.liquid(JayMotion.fast), value: pressed)
    }
}
