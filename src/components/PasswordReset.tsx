import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const PasswordReset = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return 'Salasanan tulee olla vähintään 6 merkkiä pitkä';
    }
    return null;
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate new password
    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      setError('Salasanat eivät täsmää');
      return;
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
      setError('Uusi salasana ei voi olla sama kuin nykyinen salasana');
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user || !user.email) {
        setError('Käyttäjää ei löytynyt. Kirjaudu uudelleen sisään.');
        setLoading(false);
        return;
      }

      // Reauthenticate user first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      if (error.code === 'auth/wrong-password') {
        setError('Nykyinen salasana on väärä');
      } else if (error.code === 'auth/weak-password') {
        setError('Uusi salasana on liian heikko');
      } else if (error.code === 'auth/requires-recent-login') {
        setError('Turvallisuussyistä sinun tulee kirjautua uudelleen sisään ennen salasanan vaihtoa');
      } else {
        setError('Salasanan vaihto epäonnistui. Yritä uudelleen.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Vaihda salasana
        </CardTitle>
        <CardDescription>
          Vaihda tilisi salasana.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Nykyinen salasana</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Syötä nykyinen salasanasi"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Uusi salasana</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Syötä uusi salasana"
            />
            <p className="text-xs text-gray-500">
              Vähintään 6 merkkiä
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Vahvista uusi salasana</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Syötä uusi salasana uudelleen"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Salasana vaihdettu onnistuneesti!
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full"
          >
            {loading ? 'Vaihdetaan salasanaa...' : 'Vaihda salasana'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PasswordReset;