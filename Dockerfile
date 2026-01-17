FROM ubuntu:22.04

# Install system dependencies for Wails and Playwright
RUN apt-get update && apt-get install -y \
    # Basic build tools
    build-essential \
    pkg-config \
    wget \
    curl \
    git \
    # GTK and WebKit for Wails
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    xvfb \
    # Playwright system dependencies (--with-deps)
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo-gobject2 \
    libcairo2 \
    libdbus-glib-1-2 \
    libenchant-2-2 \
    libepoxy0 \
    libfontconfig1 \
    libgbm1 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libharfbuzz0b \
    libicu70 \
    libjpeg-turbo8 \
    liblcms2-2 \
    libnspr4 \
    libnss3 \
    libopenjp2-7 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libwayland-client0 \
    libwayland-egl1 \
    libwayland-server0 \
    libwebpdemux2 \
    libx11-6 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxtst6 \
    fonts-noto-color-emoji \
    libatomic1 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libfreetype6 \
    libglx0 \
    libgudev-1.0-0 \
    libproxy1v5 \
    libsecret-1-0 \
    libxcb-shm0 \
    libxcb1 \
    # Additional from logs
    libabsl20210324 \
    libass9 \
    libbluray2 \
    libchromaprint1 \
    libgme0 \
    libmpg123-0 \
    libopenmpt0 \
    libsrt1.4-gnutls \
    libssh-gcrypt-4 \
    libavutil56 \
    libcodec2-1.0 \
    libgsm1 \
    libmp3lame0 \
    libopus0 \
    libshine3 \
    libspeex1 \
    libsoxr0 \
    libswresample3 \
    libtheora0 \
    libtwolame0 \
    libvorbisenc2 \
    libvpx7 \
    libx264-163 \
    libxvidcore4 \
    libzvbi-common \
    libzvbi0 \
    libavcodec58 \
    libavformat58 \
    libbs2b0 \
    libflite1 \
    liblilv-0-0 \
    libmysofa1 \
    libasyncns0 \
    libflac8 \
    libsndfile1 \
    libpulse0 \
    libsphinxbase3 \
    libpocketsphinx3 \
    libpostproc55 \
    libsamplerate0 \
    librubberband2 \
    libswscale5 \
    libvidstab1.1 \
    libzimg2 \
    libcaca0 \
    libcdio19 \
    libcdio-cdda2 \
    libcdio-paranoia2 \
    libdc1394-25 \
    libiec61883-0 \
    libjack-jackd2-0 \
    libopenal-data \
    libsndio7.0 \
    libopenal1 \
    libdecor-0-0 \
    libsdl2-2.0-0 \
    libxcb-shape0 \
    libxv1 \
    libavdevice58 \
    ffmpeg \
    fonts-freefont-ttf \
    fonts-tlwg-loma-otf \
    fonts-unifont \
    fonts-wqy-zenhei \
    liborc-0.4-0 \
    libgstreamer-plugins-base1.0-0 \
    gstreamer1.0-libav \
    libgstreamer-plugins-good1.0-0 \
    libshout3 \
    libtag1v5 \
    libv4lconvert0 \
    libv4l-0 \
    libwavpack1 \
    gstreamer1.0-plugins-good \
    libgav1-0 \
    libyuv0 \
    libavif13 \
    libdvdread8 \
    libdvdnav4 \
    libegl-mesa0 \
    libevent-2.1-7 \
    libfaad2 \
    libffi7 \
    libinstpatch-1.0-2 \
    timgm6mb-soundfont \
    libfluidsynth3 \
    libfreeaptx0 \
    libgraphene-1.0-0 \
    libgssdp-1.2-0 \
    libegl1 \
    libgstreamer-gl1.0-0 \
    libgtk-4-common \
    libgtk-4-1 \
    libgupnp-1.2-1 \
    libgupnp-igd-1.0-4 \
    libharfbuzz-icu0 \
    libhyphen0 \
    libkate1 \
    libldacbt-enc2 \
    libltc11 \
    libevdev2 \
    libmanette-0.2-0 \
    libmjpegutils-2.1-0 \
    libmodplug1 \
    libmpcdec6 \
    libmpeg2encpp-2.1-0 \
    libmplex2-2.1-0 \
    libnice10 \
    libnotify4 \
    libopenh264-6 \
    libopenni2-0 \
    libqrencode4 \
    libsoundtouch1 \
    libsoup-3.0-0 \
    libspandsp2 \
    libsrtp2-1 \
    libwebrtc-audio-processing1 \
    libwildmidi2 \
    libwoff1 \
    libxslt1.1 \
    libzbar0 \
    libzxingcore1 \
    xfonts-encodings \
    xfonts-utils \
    xfonts-cyrillic \
    xfonts-scalable \
    libdca0 \
    libgstreamer-plugins-bad1.0-0 \
    libsbc1 \
    libvo-aacenc0 \
    libvo-amrwbenc0 \
    gstreamer1.0-plugins-bad \
    libgles2 \
    libopengl0 \
    libgtk-3-dev \
    libjavascriptcoregtk-4.0-18 \
    libspa-0.2-modules \
    libpipewire-0.3-0 \
    libpipewire-0.3-common \
    libpipewire-0.3-modules \
    libpsl-dev \
    libsoup2.4-dev \
    xdg-dbus-proxy \
    libwebkit2gtk-4.0-37 \
    pipewire-bin \
    pipewire \
    pipewire-media-session \
    rtkit \
    xdg-desktop-portal \
    xdg-desktop-portal-gtk \
    libjavascriptcoregtk-4.0-dev \
    libwebkit2gtk-4.0-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install Go
RUN wget https://go.dev/dl/go1.24.11.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.24.11.linux-amd64.tar.gz && \
    rm go1.24.11.linux-amd64.tar.gz
ENV PATH="/usr/local/go/bin:$PATH"

# Pre-install Playwright and browsers
RUN bun add @playwright/test && \
    bunx playwright install --with-deps

# Pre-install Wails
RUN go install github.com/wailsapp/wails/v2/cmd/wails@latest
ENV PATH="/root/go/bin:$PATH"

# Set working directory
WORKDIR /workspace
