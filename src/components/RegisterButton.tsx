import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export const RegisterButton = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const success = await register(formData.email, formData.password);
      if (success) {
        toast.success("🎉 Welcome! Account created successfully and you're now logged in.", {
          duration: 4000
        });
        setIsOpen(false);
        setFormData({ email: "", password: "", confirmPassword: "" });
        
        // Small delay to let Firebase auth state update, then navigate
        setTimeout(() => {
          navigate('/workspace/purchaser');
        }, 100);
      } else {
        toast.error("Failed to create account. Please try again.");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="text-white px-10 py-4 rounded-full text-lg font-light shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105" style={{backgroundColor: '#003d3b'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e2a54'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#003d3b'}>
          Luo tili
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Your Account</DialogTitle>
          <DialogDescription>
            Join the Retta Property Manager AI Assistant to start testing property management intelligence.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="register-email">Email</Label>
            <Input
              id="register-email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-password">Password</Label>
            <Input
              id="register-password"
              type="password"
              placeholder="Create a password (min 6 characters)"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full text-white"
            style={{backgroundColor: '#003d3b'}}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e2a54'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#003d3b'}
            disabled={isLoading}
          >
            {isLoading ? "Luodaan tiliä..." : "Luo tili"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};