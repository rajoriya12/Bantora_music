import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bantora.music',
  appName: 'Bantora',
  webDir: 'out',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#070709',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  plugins: {
    // Allow reading files from the app bundle
    Filesystem: {
      androidScheme: 'https',
    },
    // Status bar style to match dark UI
    StatusBar: {
      style: 'dark',
      backgroundColor: '#070709',
    },
    // Splash screen
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#070709',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
