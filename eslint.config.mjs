import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "out/**", "node_modules/**"] },
  {
    rules: {
      /*
       * Agent Relay is a static export with no server: every piece of state it starts from
       * — localStorage, window.location, the Technocore room itself — is unreadable until
       * the component has mounted in a browser. Reading it in a mount effect and calling
       * setState with the result is the correct pattern here, not a cascading-render bug,
       * and the alternatives the rule suggests (useSyncExternalStore over a value that
       * changes every call) are worse. Purity and ref rules stay on.
       */
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
