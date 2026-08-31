// Strip local asset url(...) references from Leaflet's CSS before Metro's
// web bundler tries to resolve them. SIGAP's web map components use custom
// divIcon/circle markers and never rely on Leaflet's default marker or layer
// control images, so these rules are safe to drop. This avoids the
// "Importing local resources in CSS is not supported yet" warnings and the
// downstream PackageResolutionError that Metro can throw for them.
module.exports = {
  plugins: [
    {
      postcssPlugin: 'sigap-strip-leaflet-local-assets',
      Once(root, { result }) {
        const from = result.opts.from ?? '';
        if (!from.includes('leaflet/dist/leaflet.css')) return;

        root.walkDecls('background-image', (decl) => {
          if (
            decl.value.includes('url(') &&
            !/^\s*(data:|https?:|#)/i.test(decl.value)
          ) {
            decl.remove();
          }
        });
      },
    },
  ],
};
