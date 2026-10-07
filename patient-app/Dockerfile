FROM ghcr.io/cirruslabs/flutter:stable AS build
WORKDIR /app

# This repo ships only pubspec.yaml + lib/ (platform scaffolding was
# intentionally skipped when the app was written), but `flutter build web`
# needs web/index.html etc. Generate the standard scaffold first, then lay
# our pubspec.yaml and lib/ on top of it.
RUN flutter create --platforms web --project-name patient_app .
COPY pubspec.yaml ./
RUN flutter pub get
COPY . .

# Baked in at build time via --dart-define (this code was never compiled
# locally — no Flutter SDK was available when it was written — so this
# build is also the first real compile check for it).
ARG API_URL=http://localhost:8080/api/v1
RUN flutter build web --dart-define=API_URL=$API_URL

FROM nginx:alpine AS runtime
COPY --from=build /app/build/web /usr/share/nginx/html
EXPOSE 80
