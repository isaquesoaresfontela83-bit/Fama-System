import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**", ".sites-runtime/**", ".wrangler/**", "ai/**",
  ]),
  {
    files: ["components/ui/**/*.{js,jsx}", "hooks/use-mobile.js"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Keep existing React compiler diagnostics visible during the language migration.
  // Behavior-preserving conversion does not refactor the legacy effect lifecycle.
  { files: ["app/agenda-google-calendar.jsx", "app/agenda-weekly-planner.jsx", "app/auth/confirmar/page.jsx", "app/chat-workspace.jsx", "app/cloriva-app.jsx", "app/consultation-workspace.jsx", "app/dashboard-balance.jsx", "app/field-conditions.jsx", "app/general-management.jsx", "app/inventory-camera.jsx", "app/nearby-places.jsx", "app/operation-map.jsx", "app/operational-map-view.jsx", "app/push-preferences.jsx", "app/view-customizer.jsx", "hooks/use-assistant-connection.js", "hooks/use-client-mutation.js", "hooks/use-fama-local-ai.js", "hooks/use-workspace-navigation.js"], rules: {"react-hooks/set-state-in-effect": "warn", "react-hooks/refs": "warn", "react-hooks/purity": "warn", "react-hooks/preserve-manual-memoization": "warn"} },
]);

export default eslintConfig;
