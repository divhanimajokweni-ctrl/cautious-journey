{ pkgs }: {
  deps = [
    pkgs.nodejs_24
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
    pkgs.chromium
    pkgs.ffmpeg
    pkgs.alsa-utils
  ];
}
