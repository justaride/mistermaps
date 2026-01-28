import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Theme } from "../types";
import styles from "./CodeViewer.module.css";

type Props = {
  code: string;
  isOpen: boolean;
  theme: Theme;
  onClose: () => void;
};

export function CodeViewer({ code, isOpen, theme, onClose }: Props) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
  };

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
        <SyntaxHighlighter
          language="typescript"
          style={theme === "dark" ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
