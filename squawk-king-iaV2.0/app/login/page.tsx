import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-4" style={{ background: "var(--panel-bg)" }}>
      <AuthForm mode="login" />
    </main>
  );
}
