import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  AuthLayout,
  AuthLink,
  ErrorAlert,
  FormInput,
  SubmitButton,
} from '../components/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in to your account">
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <ErrorAlert message={error} />

        <div className="space-y-4">
          <FormInput
            id="email"
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />

          <FormInput
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </div>

        <SubmitButton isLoading={isLoading} loadingText="Signing in..." text="Sign in" />

        <AuthLink text="Don't have an account?" linkText="Register" to="/register" />
      </form>
    </AuthLayout>
  );
}
