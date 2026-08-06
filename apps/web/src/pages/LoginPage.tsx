import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../contexts/auth-context";
import { ApiError } from "../lib/api-client";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

const schema = z.object({
  organizationSlug: z.string().min(1, "Obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Obrigatório"),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="mb-1 text-lg font-semibold text-slate-100">Santos SAF</h1>
        <p className="mb-6 text-sm text-slate-500">Entre com sua organização</p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input label="Slug da organização" placeholder="acme-contabilidade" {...register("organizationSlug")} error={errors.organizationSlug?.message} />
          <Input label="E-mail" type="email" {...register("email")} error={errors.email?.message} />
          <Input label="Senha" type="password" {...register("password")} error={errors.password?.message} />
          {serverError && <p className="text-sm text-red-400">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="justify-center">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
