import Workspace from "./Workspace";

export default function Layout() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Workspace />
    </div>
  );
}
