import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, User } from 'lucide-react';
import {
  isFairTenantEmail,
  fairSignupDomainHint,
  isFairSignupEmailForSlug,
} from '@/lib/fair-tenant';
import { useFairCompanies } from '@/hooks/useFairCompanies';
import { BrandLogo } from '@/components/BrandLogo';
import { FairEventFooter } from '@/components/fair/FairEventFooter';
import { FAIR_APP_HOME, isFairHostname } from '@/lib/fair-origins';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, 'Informe seu nome'),
});

function isFairAuthFlow(location: { pathname: string; search: string; state: unknown }): boolean {
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '';
  if (from.startsWith('/feira')) return true;
  const params = new URLSearchParams(location.search);
  if (params.get('feira') === '1') return true;
  if (params.get('tenant')?.trim()) return true;
  if (typeof window !== 'undefined' && window.location.hostname.includes('feira')) return true;
  return false;
}

function fairSignupTenantSlug(search: string): string | null {
  const slug = new URLSearchParams(search).get('tenant')?.trim().toLowerCase();
  return slug || null;
}

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const fairFlow = isFairAuthFlow(location);
  const signupTenantSlug = fairSignupTenantSlug(location.search);
  const signupDomainLabel = fairSignupDomainHint(signupTenantSlug);

  const [mode, setMode] = useState<'login' | 'signup'>(fairFlow ? 'signup' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loginErrors, setLoginErrors] = useState<{
    email?: string;
    password?: string;
    fullName?: string;
  }>({});
  const { data: fairCompanies = [] } = useFairCompanies(!!user);

  // Password reset dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
      if (isFairHostname()) {
        navigate(from.startsWith('/feira') ? from : '/feira', { replace: true });
        return;
      }
      if (isFairTenantEmail(user.email, fairCompanies)) {
        window.location.replace(FAIR_APP_HOME);
        return;
      }
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, location, fairCompanies]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});

    const parsed =
      mode === 'signup'
        ? signupSchema.safeParse({ email: loginEmail, password: loginPassword, fullName })
        : loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!parsed.success) {
      const errors: { email?: string; password?: string; fullName?: string } = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0] === 'email') errors.email = err.message;
        if (err.path[0] === 'password') errors.password = err.message;
        if (err.path[0] === 'fullName') errors.fullName = err.message;
      });
      setLoginErrors(errors);
      return;
    }

    if (
      mode === 'signup' &&
      signupTenantSlug &&
      !isFairSignupEmailForSlug(loginEmail, signupTenantSlug)
    ) {
      const hint = signupDomainLabel ?? 'corporativo do embarcador';
      setLoginErrors({ email: `Use e-mail ${hint}` });
      toast.error(`Cadastro só com e-mail ${hint}`);
      return;
    }

    if (mode === 'signup' && !loginEmail.includes('@')) {
      setLoginErrors({ email: 'Informe e-mail corporativo do embarcador' });
      toast.error('Cadastro só com e-mail corporativo do embarcador');
      return;
    }

    setIsLoading(true);
    const { error } =
      mode === 'signup'
        ? await signUp(loginEmail, loginPassword, fullName)
        : await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      const message = error.message || '';
      if (message.includes('Invalid login credentials')) {
        toast.error(
          mode === 'signup'
            ? 'Conta já existe. Entre com a senha cadastrada.'
            : 'E-mail ou senha incorretos. Use "Esqueceu a senha?" para redefinir.'
        );
      } else if (message.includes('Email not confirmed')) {
        toast.error('E-mail não confirmado. Verifique sua caixa de entrada.');
      } else if (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('Failed to fetch')
      ) {
        toast.error('Erro de rede. Verifique sua conexão.');
      } else if (message.includes('Unexpected token') || message.includes('Unexpected end')) {
        toast.error('Erro de comunicação com o servidor. Tente recarregar a página.');
      } else {
        toast.error(
          message ||
            (mode === 'signup' ? 'Erro ao criar conta.' : 'Erro ao fazer login. Tente novamente.')
        );
      }
      return;
    }

    toast.success(
      mode === 'signup' ? 'Conta criada. Acesso liberado.' : 'Login realizado com sucesso!'
    );
  };

  const handleResetPassword = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      toast.error('Informe um e-mail válido');
      return;
    }

    setIsLoading(true);
    const { error } = await resetPassword(resetEmail);
    setIsLoading(false);

    if (error) {
      toast.error('Erro ao enviar link de recuperação. Tente novamente.');
      return;
    }

    setResetSent(true);
    toast.success('Link de recuperação enviado! Verifique seu e-mail.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <motion.div
        className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-sidebar-primary"
                style={{
                  width: Math.random() * 300 + 50,
                  height: Math.random() * 300 + 50,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.5,
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <BrandLogo size="lg" iconWrapClassName="bg-sidebar-primary" />
          </div>

          <div className="max-w-md">
            <motion.h1
              className="text-4xl font-bold text-sidebar-foreground leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Gerencie suas operações de transporte em um só lugar
            </motion.h1>
            <motion.p
              className="mt-4 text-lg text-sidebar-muted"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Do comercial ao operacional, integre cotações, ordens de serviço e documentos com
              automação inteligente.
            </motion.p>

            <motion.ul
              className="mt-8 space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {[
                'Pipeline comercial integrado',
                'Gestão de ordens de serviço',
                'Controle documental (NF-e, CT-e, POD)',
                'Rastreamento em tempo real',
              ].map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sidebar-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  {feature}
                </li>
              ))}
            </motion.ul>
          </div>

          <p className="text-sm text-sidebar-muted">
            {fairFlow
              ? 'App para Parceiros Vectra Hub Fitness Brasil 2026'
              : '© 2024 Vectra Cargo. Todos os direitos reservados.'}
          </p>
        </div>
      </motion.div>

      {/* Right Panel - Auth Form */}
      <motion.div
        className="flex-1 flex items-center justify-center p-5 sm:p-8 bg-background"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-6 flex justify-center">
            <BrandLogo
              size="lg"
              iconWrapClassName="bg-primary"
              textPrimaryClassName="text-foreground"
              textSecondaryClassName="text-muted-foreground"
            />
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {mode === 'signup' ? 'Criar conta' : 'Entrar'}
            </h2>
            {!fairFlow && (
              <p className="text-muted-foreground mb-6">
                Entre com suas credenciais para acessar o sistema
              </p>
            )}
            {fairFlow && <div className="mb-6" />}

            {fairFlow && mode === 'signup' && signupDomainLabel && (
              <p className="mb-4 text-sm text-muted-foreground">
                Cadastro com e-mail corporativo {signupDomainLabel}.
              </p>
            )}

            {(fairFlow || mode === 'signup') && (
              <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                <Button
                  type="button"
                  variant={mode === 'login' ? 'default' : 'ghost'}
                  className="h-10"
                  onClick={() => setMode('login')}
                >
                  Entrar
                </Button>
                <Button
                  type="button"
                  variant={mode === 'signup' ? 'default' : 'ghost'}
                  className="h-10"
                  onClick={() => setMode('signup')}
                >
                  Criar conta
                </Button>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="full-name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="full-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Seu nome"
                      className={`pl-10 ${loginErrors.fullName ? 'border-destructive' : ''}`}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  {loginErrors.fullName && (
                    <p className="text-sm text-destructive">{loginErrors.fullName}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={
                      mode === 'signup' && signupDomainLabel
                        ? `nome${signupDomainLabel.split(' ou ')[0]}`
                        : mode === 'signup'
                          ? 'nome@empresa.com.br'
                          : 'E-mail'
                    }
                    className={`pl-10 ${loginErrors.email ? 'border-destructive' : ''}`}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                {loginErrors.email && (
                  <p className="text-sm text-destructive">{loginErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === 'login' && (
                    <Button
                      variant="link"
                      className="p-0 h-auto text-sm"
                      type="button"
                      onClick={() => {
                        setResetDialogOpen(true);
                        setResetSent(false);
                        setResetEmail(loginEmail);
                      }}
                    >
                      Esqueceu a senha?
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`pl-10 pr-10 ${loginErrors.password ? 'border-destructive' : ''}`}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {loginErrors.password && (
                  <p className="text-sm text-destructive">{loginErrors.password}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm font-normal">
                  Manter conectado
                </Label>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                {isLoading
                  ? mode === 'signup'
                    ? 'Criando conta...'
                    : 'Entrando...'
                  : mode === 'signup'
                    ? 'Criar conta e entrar'
                    : 'Entrar'}
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>

            {fairFlow ? (
              <FairEventFooter className="mt-8" />
            ) : (
              <p className="text-center text-sm text-muted-foreground mt-6">
                {mode === 'signup' ? (
                  signupDomainLabel ? (
                    <>Cadastro feira — domínio {signupDomainLabel}.</>
                  ) : (
                    <>
                      Cadastro com e-mail corporativo do embarcador. Domínio vem de feira.companies
                      — sem travar um tenant na tela.
                    </>
                  )
                ) : (
                  <>
                    Acesso Hub: colaboradores Vectra Cargo.
                    <br />
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-sm"
                      onClick={() => setMode('signup')}
                    >
                      Vendedor da feira? Criar conta com e-mail corporativo
                    </Button>
                  </>
                )}
              </p>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              {resetSent
                ? 'Verifique sua caixa de entrada para o link de recuperação.'
                : 'Informe seu e-mail para receber o link de recuperação.'}
            </DialogDescription>
          </DialogHeader>
          {!resetSent ? (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">E-mail</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu@vectracargo.com.br"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleResetPassword} disabled={isLoading}>
                  {isLoading ? 'Enviando...' : 'Enviar Link'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <Button className="w-full" onClick={() => setResetDialogOpen(false)}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
