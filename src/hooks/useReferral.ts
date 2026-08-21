import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export function useReferral() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      // Store it in local storage. It will be picked up during the signup process
      localStorage.setItem("campus_connect_referral_code", ref);
    }
  }, [searchParams]);

  const getStoredReferralCode = () => {
    return localStorage.getItem("campus_connect_referral_code");
  };

  const clearStoredReferralCode = () => {
    localStorage.removeItem("campus_connect_referral_code");
  };

  return { getStoredReferralCode, clearStoredReferralCode };
}
