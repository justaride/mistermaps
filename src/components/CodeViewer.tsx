import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import type { Theme } from "../types";
import styles from "./CodeViewer.module.css";

type Props = {
  code: string;
  isOpen: boolean;
  theme: Theme;
  onClose: () => void;
};

type PrismStyle = Record<string, CSSProperties>;
type PrismLightComponent =
  typeof import("react-syntax-highlighter/dist/esm/prism-light").default;

type LoadedSyntax = {
  Highlighter: PrismLightComponent;
  styles: {
    oneDark: PrismStyle;
    oneLight: PrismStyle;
  };
};

export function CodeViewer({ code, isOpen, theme, onClose }: Props) {
  const [loadedSyntax, setLoadedSyntax] = useState<LoadedSyntax | null>(null);

  useEffect(() => {
    if (!isOpen || loadedSyntax) return;

    let isCancelled = false;

    void Promise.all([
      import("react-syntax-highlighter/dist/esm/prism-light"),
      import("react-syntax-highlighter/dist/esm/languages/prism/typescript"),
      import("react-syntax-highlighter/dist/esm/styles/prism/one-dark"),
      import("react-syntax-highlighter/dist/esm/styles/prism/one-light"),
    ]).then(
      ([
        syntaxModule,
        languageTypescriptModule,
        oneDarkModule,
        oneLightModule,
      ]) => {
        if (isCancelled) return;

        syntaxModule.default.registerLanguage(
          "typescript",
          languageTypescriptModule.default,
        );

        setLoadedSyntax({
          Highlighter: syntaxModule.default,
          styles: {
            oneDark: oneDarkModule.default as PrismStyle,
            oneLight: oneLightModule.default as PrismStyle,
          },
        });
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [isOpen, loadedSyntax]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
  };

  const Highlighter = loadedSyntax?.Highlighter;
  const syntaxTheme = theme === "dark"
    ? loadedSyntax?.styles.oneDark
    : loadedSyntax?.styles.oneLight;

  return (
    <div className={`${styles.viewer} ${isOpen ? styles.open : ""}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Implementation Code</h3>
        <div className={styles.actions}>
          <button onClick={copyToClipboard}>Copy</button>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className={styles.codeWrapper}>
        {Highlighter && syntaxTheme ? (
          <Highlighter
            language="typescript"
            style={syntaxTheme}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {code}
          </Highlighter>
        ) : (
          <pre className={styles.fallback}>{code}</pre>
        )}
      </div>
    </div>
  );
}
