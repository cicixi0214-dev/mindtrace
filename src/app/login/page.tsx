"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        setError("密码错误");
      }
    } catch {
      setError("登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-dvh items-center justify-center p-5"
      style={{ background: "var(--color-mt-bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-sm border"
        style={{
          background: "var(--color-mt-surface)",
          borderColor: "var(--color-mt-border)",
        }}
      >
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-semibold tracking-[1px]">思迹</h1>
          <p className="text-[13px] mt-1.5" style={{ color: "var(--color-mt-text3)" }}>
            记录思想的轨迹
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码"
            autoFocus
            className="w-full px-4 py-3 rounded-xl border text-base outline-none transition-all"
            style={{
              background: "var(--color-mt-bg)",
              borderColor: "var(--color-mt-border)",
              color: "var(--color-mt-text)",
            }}
          />
          {error && (
            <p className="text-[13px] text-red-500 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-3 rounded-xl border-none text-sm font-medium cursor-pointer transition-opacity disabled:opacity-40"
            style={{
              background: "var(--color-mt-accent)",
              color: "#fff",
            }}
          >
            {loading ? "验证中…" : "进入"}
          </button>
        </form>
      </div>
    </div>
  );
}
