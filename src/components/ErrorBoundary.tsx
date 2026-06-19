import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            color: "#333",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, color: "#ef4444" }}>渲染错误</div>
          <div style={{ fontSize: 12, color: "#999", maxWidth: 400, textAlign: "center" }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              border: "1px solid #ddd",
              borderRadius: 6,
              background: "#fff",
              color: "#333",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
