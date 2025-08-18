import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { UserPlus, Mail, Key } from "lucide-react";

export const UserCreation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error("Salasanat eivät täsmää");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Salasanan tulee olla vähintään 6 merkkiä pitkä");
      return;
    }

    setIsLoading(true);

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      
      if (userCredential.user) {
        toast.success(`✅ Käyttäjä ${formData.email} luotu onnistuneesti!`, {
          duration: 4000
        });
        
        // Clear form
        setFormData({ email: "", password: "", confirmPassword: "" });
      }
    } catch (error: unknown) {
      console.error("User creation error:", error);
      if (error instanceof Error) {
        if (error.message.includes("email-already-in-use")) {
          toast.error("Sähköpostiosoite on jo käytössä");
        } else if (error.message.includes("invalid-email")) {
          toast.error("Virheellinen sähköpostiosoite");
        } else if (error.message.includes("weak-password")) {
          toast.error("Salasana on liian heikko");
        } else {
          toast.error(`Virhe käyttäjän luomisessa: ${error.message}`);
        }
      } else {
        toast.error("Käyttäjän luominen epäonnistui");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 mb-4">
        <UserPlus className="h-6 w-6 text-gray-700" />
        <h3 className="text-xl font-semibold">Luo Uusi Käyttäjä</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-user-email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Sähköpostiosoite
          </Label>
          <Input
            id="new-user-email"
            type="email"
            placeholder="uusi.kayttaja@esimerkki.fi"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            disabled={isLoading}
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="new-user-password" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Salasana
          </Label>
          <Input
            id="new-user-password"
            type="password"
            placeholder="Luo salasana (min 6 merkkiä)"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            disabled={isLoading}
            minLength={6}
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirm-new-password" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Vahvista Salasana
          </Label>
          <Input
            id="confirm-new-password"
            type="password"
            placeholder="Vahvista salasana"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
            disabled={isLoading}
            minLength={6}
            className="w-full"
          />
        </div>
        
        <Button 
          type="submit" 
          className="w-full bg-gray-800 hover:bg-gray-700 text-white"
          disabled={isLoading}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {isLoading ? "Luodaan käyttäjää..." : "Luo Käyttäjä"}
        </Button>
      </form>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-700">
          <strong>Huom:</strong> Uusi käyttäjä saa pääsyn kaikkiin jaettuihin tietoihin (hinnastot, tilaukset, AI-promptit).
        </p>
      </div>
    </div>
  );
};