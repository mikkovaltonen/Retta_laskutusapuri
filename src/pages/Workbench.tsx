import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import PropertyManagerChat from "@/components/PropertyManagerChat";

const Workbench = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <PropertyManagerChat onLogout={handleLogout} />
  );
};

export default Workbench;