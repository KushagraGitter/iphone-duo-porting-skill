---
name: "iphone-duo-porting"
description: "Port an iOS app to the foldable iPhone Duo and adopt its iOS 27.1 APIs: hinge angle, reserved regions, ArrangementView, vertical bars, dual front cameras and scene accessories."
---

# iPhone Duo porting and hinge APIs

Use this skill when a developer wants to make an existing iOS app (SwiftUI, UIKit or mixed) work well on iPhone Duo, or wants to build features on the hinge, the fold, the two front cameras or the outer display.

Everything here comes from Apple's own documentation, the HIG, the six iPhone Duo Tech Talks (111461-111466) and Apple's iPhone Duo Group Lab Q&A (Oct 2026). Items marked **VERIFY** came from sources that disagree with each other or from a third-party write-up. Check those against the SDK headers in Xcode 27.1 before relying on them. Never invent API names. If a needed symbol is not listed here, look it up at developer.apple.com (append `.md` to any documentation URL to get a plain-text version) before writing code.

## Device facts

- Two displays. The outer display is compact width and behaves like other iPhones: portrait is compact-width/regular-height, landscape is compact/compact. The inner display is regular width and regular height (room for sidebars).
- One hinge. The poses are closed, partially folded like a book, partially folded like a laptop, tent, flat (wide) and flat (tall).
- Each display has a front camera. The outer one is always visible in the corner. The inner one is under the display and visible only while active.
- On the outer display, and on the inner display in landscape, the system moves the navigation bar, toolbar and tab bar to a **vertical bar on the side**. The inner display in portrait keeps horizontal bars.
- The inner display **ignores** `UISupportedInterfaceOrientations` for layout. Apps scale there, including in Split View. `UIRequiresFullScreen` is honoured, but the app still resizes when the device opens or closes.
- Split View multitasking: two apps side by side on the inner display. Multiple windows of one app work on the inner display only. New windows can't be created on the outer display.
- Opening or closing the device is a **size and trait change, not a scene disconnect**. State, keyboard, text input, scroll position, video playback and camera sessions all survive.
- Behaviour depends on the SDK you build with:
  - iOS 26 SDK or earlier: compatibility mode. The app is centred with empty space when open, and sits left of the status bar and camera when closed.
  - iOS 27 SDK: fills most of the inner display but avoids the status bar edge.
  - iOS 27.1 SDK or later (Xcode 27.1): full edge to edge, with vertical bars. Confirm your content adapts to vertical bars before shipping this build.

## Workflow

Work through these phases in order. Phases 1-3 are the port, and every app needs them. Phases 4-7 adopt Duo-specific features. Report findings to the developer as a checklist with file:line references.

### Phase 1: Audit the codebase

Run these searches from the repo root, then read each hit in context. Not every hit is a bug, so judge each one.

```bash
# Screen-based sizing (replace all of these)
rg -n 'UIScreen\.main|UIScreen\.screens|UIWindow\(frame:' --type swift
# Orientation-driven layout
rg -n 'UIDevice\.current\.orientation|statusBarOrientation|interfaceOrientation|isLandscape|isPortrait' --type swift
# Idiom or device-size checks
rg -n 'userInterfaceIdiom|\.pad\b|\.phone\b|== ?(667|736|812|844|852|874|896|926|932|956)\b|nativeBounds' --type swift
# "Regular width means iPad" assumptions
rg -n 'horizontalSizeClass *== *\.regular' --type swift
# Custom bars that won't go vertical
rg -n 'UIToolbar\(|UINavigationBar\(|UITabBar\(|CustomTabBar|TabBarView' --type swift
# Symmetric inset assumptions
rg -n 'safeAreaInsets\.(left|right|top|bottom) *\* *2' --type swift
# Fill-cropping media
rg -n 'scaleAspectFill|contentMode: *\.fill|scaledToFill' --type swift
# Camera code that infers direction from position
rg -n 'AVCaptureDevice\.DiscoverySession|\.position *== *\.front|isVideoMirrored' --type swift
# Info.plist and lifecycle
rg -n 'UIRequiresFullScreen|UISupportedInterfaceOrientations|UIApplicationSceneManifest' -g '*.plist'
rg -n 'AppDelegate.*window *=|var window: UIWindow' --type swift
```

Also check:
- Whether the app uses the UIScene lifecycle (a scene manifest plus a `UIWindowSceneDelegate`, or the SwiftUI `App` lifecycle). If it doesn't, adopting scenes comes first.
- The deployment target. If it is below iOS 27.1, every new API needs `if #available(iOS 27.1, *)` or `@available`.
- Xcode 27.1 includes Apple's **App Resizability** agent skill. Suggest the developer ask Xcode's assistant "get my app ready for iPhone Duo", or run `xcrun agent skills export` to use it with another agent. It doesn't catch everything, which is why this audit exists.

### Phase 2: Fix the resizing patterns

1. **Stop sizing from the main screen.**
   - Replace `UIScreen.main.bounds` with `view.bounds` or `window.bounds`. In SwiftUI, use `GeometryReader` or `onGeometryChange`.
   - Replace `UIScreen.main.scale` with `traitCollection.displayScale` (UIKit) or `@Environment(\.displayScale)` (SwiftUI).
   - Replace `UIWindow(frame: UIScreen.main.bounds)` with `UIWindow(windowScene:)`.
   - Don't store a `UIScreen`. Read it when needed with `view.window?.windowScene?.screen`.
   - Apple says `UIScreen.main` is ambiguous and will be deprecated.
2. **Re-read sizes on every change.** Don't size once at launch or in `viewIsAppearing`. Lay out in `layoutSubviews` or `viewDidLayoutSubviews`, and use `viewWillTransition(to:with:)` for work that must run on size changes.
3. **Drop orientation-based layout.** To decide whether the view is wide, compare `bounds.width > bounds.height`, or the GeometryReader size. Locking to portrait doesn't stop size-class changes.
4. **Drop idiom and device-size checks.** Choose layout by size class and available space. Regular width now runs on iPhone, so it no longer means iPad. Remove hard-coded heights such as 844.
5. **Handle safe areas asymmetrically.**
   ```swift
   // Wrong: assumes opposite insets are equal
   let width = view.bounds.width - view.safeAreaInsets.left * 2
   // Right: handles each side independently
   let width = view.bounds.inset(by: view.safeAreaInsets).width
   ```
   Keep interactive foreground content inside the safe area. Let backgrounds extend with `.ignoresSafeArea()` (SwiftUI), or `backgroundView.frame = view.bounds` (UIKit).
6. **Prefer system containers.** Use `NavigationSplitView`/`UISplitViewController` (collapses when closed, tiles when open), `TabView`/`UITabBarController`, `NavigationStack`, sheets, popovers, alerts and context menus. These adapt to the fold and camera automatically. Use Auto Layout in UIKit.
7. **Opt into a sidebar on the inner display** if the app has tabs: `.defaultTabBarPlacement(.sidebar)` in SwiftUI, or `tabBarController.sidebar.preferredPlacement = .sidebar` in UIKit.
8. **Corners.** Use `ConcentricRectangle()` (SwiftUI) or `UICornerConfiguration` (UIKit) for shapes that follow the display corners.
9. **Full-bleed media.** Choose fill or fit by aspect ratio or size class, or set a focal point, so wide displays don't crop the subject.
10. **Games.** Fill the screen in every pose. Prefer changing the aspect ratio over letterboxing. If padding can't be avoided, put artwork in it.
11. **Keyboard.** Keep the focused field visible across folds with `keyboardWillChangeFrameNotification`.
12. **State that must survive a real scene disconnect.** Implement `stateRestorationActivity(for:)` with an `NSUserActivity`. Note that `@AppStorage` and `UserDefaults` are app-wide and shared by every window.

### Phase 3: Optimise bars for vertical presentation

Only bars owned by navigation containers go vertical. A standalone `UIToolbar`, `UINavigationBar` or `UITabBar`, or a custom SwiftUI bar, is **not** considered. Migrate those first.

- **SwiftUI:** put `.toolbar { }` inside a `NavigationStack` or `NavigationSplitView`, and use `TabView`.
- **UIKit:** set `navigationItem` and toolbar items on a view controller inside a `UINavigationController` or `UITabBarController`.

Rules:
- **Order:** the top of the vertical bar is for Back or Close, followed by prominent actions such as Done.
  - SwiftUI: `ToolbarItem(placement: .cancellationAction)` for a custom Back/Close, and `ToolbarItem(placement: .topBarPinnedTrailing)` for Done.
  - UIKit: `navigationItem.leadingItemGroups = [UIBarButtonItemGroup(...)]`, and `navigationItem.pinnedTrailingGroup = UIBarButtonItemGroup(...)`. The talk also sets `leftItemsSupplementBackButton = false` (**VERIFY** the spelling: the transcript and sample differ).
- **Give every item an icon and a title.** Use `Label` in SwiftUI, or a title plus image in UIKit. A vertical bar shows the icon and the overflow menu shows both. An item with only a title, or with a custom view, never goes vertical.
- **Choosing an axis:**
  ```swift
  // SwiftUI
  ToolbarItem { ProfileView() }.axisBehavior(.verticalPreferred) // custom view allowed in the vertical bar
  ToolbarItem { SelectOrDoneButton() }.axisBehavior(.horizontalOnly)
  // UIKit
  item.axisBehavior = .verticalPreferred   // or .horizontalOnly
  ```
  Custom views in a vertical bar must fit its fixed width.
- **Overflow priority:** items overflow from the bottom up. Raise frequent actions and badged items.
  ```swift
  ToolbarItem { Button(...) }.visibilityPriority(.high)   // SwiftUI
  item.visibilityPriority = .high                          // UIKit
  ```
- **Use the system overflow menu**, not your own ellipsis menu.
  ```swift
  // SwiftUI
  .toolbar { ToolbarOverflowMenu { Button("Scan") { }; Button("Connect") { } } }
  // UIKit
  navigationItem.additionalOverflowItems = UIDeferredMenuElement({ provider in provider(self.persistentOverflowItems()) })
  ```
- **Compression:** navigation-focused apps keep the tab bar (the default). Task-focused apps keep the toolbar instead.
  ```swift
  .toolbarVerticalCompressionBehavior(.prefersToolbarItems)        // SwiftUI
  navigationItem.verticalBarCompressionBehavior = .prefersBarItems // UIKit (VERIFY the case name)
  ```
- **Badges:** `.badge(7)` in SwiftUI, or `item.badge = .count(7)` in UIKit.
- **Custom layouts next to a vertical bar:** read the edge and align to it.
  ```swift
  @Environment(\.toolbarVerticalEdge) var edge          // HorizontalEdge?; nil when bars are horizontal
  switch traitCollection.verticalBarEdge { ... }         // UIKit trait
  ```
  Use this, not size class or orientation, to detect vertical bars.
- **Hero images:** extend them under the bar with `.backgroundExtensionEffect()` (SwiftUI) or `UIBackgroundExtensionView` (UIKit).
- **Opting out:** only for single-page, bottom-heavy layouts (such as a calculator) or sheets with a single close button.
  ```swift
  NavigationStack { ContentView().toolbarVerticalBehavior(.disabled) }   // SwiftUI
  override var preferredVerticalBarBehavior: UIVerticalBarBehavior { .disabled } // UIKit
  ```
- **Sheets:** on the outer display, sheets get vertical bars. On the inner display, leading or centred sheets get horizontal bars and trailing sheets get vertical ones. Set placement with `presentationPlacement(_:)` (SwiftUI) or `UISheetPresentationController.preferredPlacement` (UIKit).
- **Contexts:** split views use vertical bars only in the detail column. Inspectors keep horizontal bars. RTL languages keep the vertical bar on the same hardware side.
- Keep controls that act on one pane next to that pane. For example, Mail's list controls stay above the list.

### Phase 4: Lay out around the fold with ArrangementView

Use this when a screen already looks like an HStack/VStack (two related panes) or a ZStack (foreground over background).

`ArrangementView<Primary, Secondary>` (SwiftUI) and `UIArrangementViewController` (UIKit) are available from iOS 27.1. They also work on iPad, Mac Catalyst and visionOS, so they aren't Duo-only.

- **`.split`** (the default): side by side when wider than tall, stacked when taller than wide. In landscape the primary is leading. In portrait the primary is on top. A closed Duo in landscape shows only the primary. Panes adapt around the fold. Use it for main/detail, such as a player plus its transcript.
- **`.overlay`:** when flat (closed or fully open), the primary sits above the secondary on the z-axis. When folded, they separate: in landscape the secondary is leading and the primary trailing, and in portrait the secondary is on top and the primary below. Use it for a clear foreground/background, such as playback controls over video.
- **Limiting axes:** `.split.axes(.horizontal)` or `.overlay.axes(...)`. For example, split only in landscape and show just the primary in portrait.

```swift
// SwiftUI
NavigationStack {                // navigation goes OUTSIDE
    ArrangementView {
        PlayerView()
    } secondary: {
        UpNextView()
    }
    .arrangementViewStyle(.split.axes(.horizontal))
}

// Collapse or expand overlay content by z-index
struct UpNextView: View {
    @Environment(\.overlayArrangementZIndex) private var zIndex: Int
    var body: some View { UpNextList(minimization: zIndex > 0 ? .collapsed : .expanded) }
}
```

```swift
// UIKit
let arrangementVC = UIArrangementViewController()
let nav = UINavigationController(rootViewController: arrangementVC)
arrangementVC.setViewController(PlayerViewController(), for: .primary)
arrangementVC.setViewController(UpNextViewController(), for: .secondary)
arrangementVC.updateArrangement(.split.axes(.horizontal))   // or .overlay; also updateArrangement(_:animated:)
let zIndex = arrangementVC.state(for: .primary)?.zIndex ?? 0
```

Rules:
- Never put an arrangement inside a `List`, `ScrollView`, grid, collection view or `NavigationSplitView`.
- Never put a `NavigationSplitView` or `TabView` inside an arrangement.
- Feeds and articles that scroll continuously shouldn't split.

For custom ratios and sizes, see `SplitArrangementViewStyle` ("Adjust layout sizing in a split arrangement") and `UISplitArrangement`. Third-party write-ups name `splitArrangementLayoutRatio(_:)` and `splitArrangementFixedLayoutSize(horizontal:vertical:)`. **VERIFY** these in the docs before using them.

### Phase 5: Handle reserved regions in custom views

There are two kinds of reserved region:
- **`.division`:** the fold. It is active only when the device is partially open (or closed). When fully open it is inactive and has zero width.
- **`.occlusion`:** the outer camera (always active, and it grows into the Dynamic Island for Live Activities), the inner camera (active only while in use) and iPad window controls.

Touches over a reserved region may be suppressed. System containers already avoid these regions. Query them only for custom overlays, floating controls, custom bars, explicit-frame layouts, and scroll content whose items mustn't straddle the fold.

The API is iOS 27.1+.
- SwiftUI: `GeometryProxy.reservedRegions(kind:options:layoutDirectionBehavior:) -> [ReservedRegion]`. `ReservedRegion` has `id`, `kind`, `frame: CGRect` (in the view's own coordinates, margins already included), `margins: EdgeInsets` and `isActive`.
- UIKit: `UIView.reservedRegions(kind:options:) -> [UIView.ReservedRegion]`.
- The options are `[]` (active regions only; default) or `.includeInactive`.
- `layoutDirectionBehavior`: by default, frames are mirrored for RTL. Pass `.fixed` for unmirrored frames.

```swift
// Split custom content at the fold (from Apple's ReservedRegion docs)
GeometryReader { proxy in
    if let division = proxy.reservedRegions(kind: .division).first {
        let f = division.frame
        if f.height > f.width {          // vertical fold: side by side
            HStack(spacing: 0) {
                FirstPane().frame(width: f.minX)
                Color.clear.frame(width: f.width)
                SecondPane().frame(width: proxy.size.width - f.maxX)
            }
        } else {                          // horizontal fold: stacked
            VStack(spacing: 0) {
                FirstPane().frame(height: f.minY)
                Color.clear.frame(height: f.height)
                SecondPane().frame(height: proxy.size.height - f.maxY)
            }
        }
    } else { FirstPane() }
}

// Push a custom top bar below any occlusion that overlaps it
let topInset = proxy.reservedRegions(kind: .occlusion)
    .filter { $0.frame.intersects(CGRect(x: 0, y: 0, width: proxy.size.width, height: 60)) }
    .map(\.frame.maxY).max() ?? 0
```

Tips:
- To avoid layout jumps, reserve space for inactive regions too: query with `.includeInactive` and check `isActive`.
- Prefer an even number of grid columns whenever a division exists (`.includeInactive` lets you decide this ahead of time).
- In a custom `Layout`, compute from `(0,0)` and add `bounds.origin` only when placing views.
- Read regions in the same view that positions the content, so the coordinates match.
- Make small adjustments rather than rearranging the screen when the device folds.

### Phase 6: Hinge-driven interactions

Use hinge data for **interactions and effects only**. For layout, use phases 4-5. The update rate and precision are system policy and aren't guaranteed. There is no single "pose" value. To infer a pose, combine the hinge status, hinge angle, size class and `toolbarVerticalEdge`.

SwiftUI, iOS 27.1+:

```swift
nonisolated func onHingeChange(isEnabled: Bool = true,
    _ action: @escaping (DeviceHingeContext, DeviceHingeContext) -> Void) -> some View
// DeviceHingeContext.hinge: DeviceHinge?   (nil means no hinge on this device)
// DeviceHinge.angle: Angle                (read .degrees)
// DeviceHinge.status: .closed / .partiallyOpen / .fullyOpen
```

UIKit, iOS 27.1+:

```swift
let interaction = UIHingeInteraction { [weak self] _, update in   // capture self weakly: the handler is stored
    guard let self else { return }
    guard let hinge = update.hinge else { self.hingeUnavailable(); return }  // nil means not in a hinge-providing hierarchy
    self.apply(angle: hinge.angle, status: hinge.status)
}
view.addInteraction(interaction)   // interaction.isEnabled toggles it
```

The handler fires once with the initial state, then on every change, and again when the view moves between hierarchies. **VERIFY**: a third-party write-up says `UIHinge.angle` is a `CGFloat` in radians and that UIKit status adds `.unknown`. Check the `UIHingeInteraction.Update` docs.

Backward-compatible wrapper, so call sites stay clean when the deployment target is below 27.1:

```swift
struct HingeReading: Equatable {
    enum Status { case closed, partiallyOpen, fullyOpen, unknown }
    var degrees: Double
    var status: Status
}

extension View {
    /// Calls `action` with the current hinge reading, or nil when the device has no hinge or the OS is older than 27.1.
    @ViewBuilder
    func onHingeReading(isEnabled: Bool = true, perform action: @escaping (HingeReading?) -> Void) -> some View {
        if #available(iOS 27.1, *) {
            self.onHingeChange(isEnabled: isEnabled) { _, new in
                action(new.hinge.map { h in
                    let status: HingeReading.Status
                    switch h.status {
                    case .closed: status = .closed
                    case .partiallyOpen: status = .partiallyOpen
                    case .fullyOpen: status = .fullyOpen
                    default: status = .unknown
                    }
                    return HingeReading(degrees: h.angle.degrees, status: status)
                })
            }
        } else {
            self.onAppear { action(nil) }
        }
    }
}
```

Patterns that work:
- **Gate on `.partiallyOpen`** and reset the effect in any other status. This is Apple's pitch-bend sample.
- **Use relative motion, not absolute angles.** Anchor the angle when the device enters `.partiallyOpen`, then map the delta (for example, 2° = one frame when scrubbing). Apple doesn't document the reported range.
- **Smooth and dead-band.** Interpolate toward the target with `withAnimation` or a spring, and ignore changes under about 1°.
- **Always provide a non-hinge path.** Every hinge gesture needs a button or slider equivalent for other iPhones, for accessibility, and for people who don't want to fold the phone. Expose an `isEnabled` toggle ("Fold to scrub").
- Good uses: zoom or scrub dials, instrument bends, the reveal and parallax depth of an effect, a "book closing" save cue, game mechanics. Bad uses: anything that decides layout, or anything that needs exact timing.
- Device attitude relative to a display: conform a view to `CMBodyIdentifiable`, set `CMMotionManager.deviceMotionBody`, then call `startDeviceMotionUpdates(using:)`. This works only when the app is full screen on that display.

### Phase 7: Cameras and the outer display

**Front camera.** With `AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera], mediaType: .video, position: .front)`, Duo returns the **virtual front camera**. It follows the app between displays automatically and is limited to what both cameras share (1080p, 60 fps, no depth). Its `isVirtualDevice` is `true`, and `activePrimaryConstituent` tells you which physical camera is streaming. Existing apps keep working.

Camera-first apps use the physical cameras instead: `.builtInOuterUltraWideCamera` (up to 4K/120 fps) and `.builtInInnerUltraWideCamera` (1080p, up to 60 fps).

**Direction.** `AVCaptureDevice.position` reports where a camera sits, not which way it faces. Use `AVCaptureDeviceDirectionCoordinator` (AVKit) instead:

```swift
@MainActor final class DirectionObserver {
    private var coordinator: AVCaptureDeviceDirectionCoordinator?
    private var active: AVCaptureDeviceDescriptor?
    let capture: CaptureService   // your actor
    init(capture: CaptureService) { self.capture = capture }

    func start(previewView: UIView) {
        coordinator = AVCaptureDeviceDirectionCoordinator(
            view: previewView,
            deviceTypes: [.builtInOuterUltraWideCamera, .builtInInnerUltraWideCamera, .builtInDualWideCamera]
        ) { [weak self] map in self?.changed(map) }
    }

    private func changed(_ map: AVCaptureDeviceDirectionMap) {
        let forward = map.forwardFacingDeviceDescriptors
        if let active, forward.contains(active) { return }
        guard let next = forward.first else { return }
        active = next
        Task { try await capture.selectCamera(with: next) }   // never call AVFoundation in this handler
    }
}
```

Coordinator rules:
- List every built-in camera you capture from, including rear ones (a rear camera can face forward). Leave out the virtual front camera.
- Keep a strong reference for as long as the view is on screen. Create one coordinator per preview view.
- It runs on the main actor. `deviceDirections` is empty until the first callback.
- In the actor, resolve the descriptor with `AVCaptureDevice(uniqueID:)`, handle `nil`, and swap a single input inside `beginConfiguration`/`commitConfiguration`. Don't use a multicam session for this.
- Mask the preview during the switch.

**Mirroring.** Decide it from the direction map, not from `position`. Mirror when a rear camera faces forward, and don't mirror when a front camera faces backward.
- Set `connection.automaticallyAdjustsVideoMirroring = false` **before** setting `isVideoMirrored`, or it throws.
- Guard with `isVideoMirroringSupported`.
- Reapply after every input change.
- Create a new `AVCaptureDevice.RotationCoordinator` per camera.

**Content on the outer display (scene accessories).** An app can't draw on the outer display directly. It goes through scene accessories (`CameraCaptureAccessory`; AlarmKit alarm scenes also appear there).
- `CameraCaptureAccessory` appears only when the device is open, the app is foreground and full screen on the inner display, and a capture session is active.
- The system can withdraw it at any time, so it must be an enhancement and never the only way to do something.
- Register it on the same view as the capture UI.

```swift
// SwiftUI
CameraPreview()
    .sceneAccessory {
        CameraCaptureAccessory(isEnabled: $model.scriptEnabled) { ScriptView(model: model) }
            .onAvailabilityChange { model.isAvailable = $0 }
    }
    .toolbar { ScriptToggle(isOn: $model.scriptEnabled).disabled(!model.isAvailable) }
```

```swift
// UIKit
let config = UISceneConfiguration(); config.delegateClass = ScriptSceneDelegate.self
registration = registerSceneAccessory(.cameraCapture(sceneConfiguration: config, userInfo: script))
// Keep `registration` (UISceneAccessoryRegistration) strongly; read .isAvailable in updateProperties(); set .isEnabled for the user's toggle.
// In the delegate: connectionOptions.sceneAccessoryUserInfo; session role == .windowCameraCaptureAccessory
// Remove with unregisterSceneAccessory(_:)
```

Share one observable model between the main UI and the accessory, and keep interaction on the outer display minimal.

**Multiple windows.** Wrap "new window" actions in `UIWindowScene.ActivationAction`, which hides itself where windows can't be created, and handle errors from scene requests.

## Testing

- **Xcode 27.1 Device Hub, iPhone Duo simulator:** use its buttons to open, close, fold and rotate. In Split View, drag the app by the home indicator to each side.
- **Fast resize testing:** the resizable iOS simulator, or iPhone Mirroring on macOS 27 (drag to extreme sizes).
- **Camera:** the simulator has no camera, so test direction switching, mirroring and capture accessories on hardware.
- **Hardware also catches** reachability problems, touch targets near the fold and weight-related ergonomics that the simulator misses.
- **Test matrix:** {closed, partially folded book, partially folded laptop, tent, open} × {portrait, landscape} × {full screen, Split View left, Split View right}. In each cell: navigate deep, open a sheet, type in a field, play video, then fold mid-task.
- **Accessibility:** run the largest Dynamic Type sizes in every pose, and use VoiceOver with any custom grid that spans the fold.
- **Web content:** Safari 27.1 has experimental Viewport Segments and Device Posture (Settings > Apps > Safari > Advanced > Feature Flags). Web apps can't detect Duo, so use responsive design.

## Shipping

- Build with the iOS 27.1 SDK. From April 2027, App Store uploads require the iOS 27 SDK or later.
- Upload iPhone Duo screenshots in App Store Connect. That alone adds the "Made for iPhone Duo" badge to the product page.
- Preview your assets in App Store Connect, and say in a featuring nomination that the app supports all poses.

## Anti-patterns to flag in review

- Custom layouts for each pose. Instead, use compact width for the outer display and regular width for the inner one.
- Using the hinge angle to choose a layout.
- Using absolute hinge angles or assuming an update rate.
- Text-only or custom-view toolbar items you expect to go vertical.
- Your own ellipsis menu.
- Overriding the vertical bar placement without a strong reason.
- Content or controls sitting in the fold.
- Treating the camera's `position` as its facing direction.
- Essential UI that exists only in a scene accessory.
- `UIScreen.main`, orientation checks, idiom checks.

## Primary sources

- Preparing your app for iPhone Duo: https://developer.apple.com/documentation/technologyoverviews/preparing-your-app-for-iphone-duo
- HIG, Designing for iPhone Duo: https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo
- Get Ready for iPhone Duo (three steps): https://developer.apple.com/iphone-duo/prepare/
- API reference:
  - ArrangementView: https://developer.apple.com/documentation/swiftui/arrangementview
  - UIArrangementViewController: https://developer.apple.com/documentation/uikit/uiarrangementviewcontroller
  - ReservedRegion (SwiftUI): https://developer.apple.com/documentation/swiftui/reservedregion
  - UIView.ReservedRegion: https://developer.apple.com/documentation/uikit/uiview/reservedregion
  - onHingeChange: https://developer.apple.com/documentation/swiftui/view/onhingechange(isenabled:_:)
  - UIHingeInteraction: https://developer.apple.com/documentation/uikit/uihingeinteraction
- Camera articles:
  - Choosing a camera by the direction it faces: https://developer.apple.com/documentation/avkit/choosing-a-camera-by-the-direction-it-faces
  - Registering a camera capture accessory on iPhone Duo: https://developer.apple.com/documentation/avfoundation/registering-a-camera-capture-accessory-on-iphone-duo
- Tech Talks: 111461 (Prepare), 111462 (Vertical bars), 111463 (Adaptive layouts), 111464 (Hinge and scenes), 111465 (Camera), 111466 (Design), at https://developer.apple.com/videos/play/tech-talks/<id>/
- Group Lab Q&A: https://developer.apple.com/forums/thread/847644