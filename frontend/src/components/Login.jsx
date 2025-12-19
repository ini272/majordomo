import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { COLORS } from '../constants/colors';

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.target);
    const homeId = parseInt(form.get('homeId'));
    const username = form.get('username');
    const password = form.get('password');

    try {
      const data = await api.auth.login(homeId, username, password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('username', username);
      onLoginSuccess(data.access_token);
      
      // Check for next redirect param
      const params = new URLSearchParams(window.location.search);
      const nextUrl = params.get('next');
      
      if (nextUrl) {
        navigate(nextUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-8 md:p-10 max-w-md mx-auto shadow-lg"
      style={{backgroundColor: COLORS.darkPanel, borderColor: COLORS.gold, borderWidth: '4px'}}
    >
      {/* Error */}
      {error && (
        <div className="px-4 py-3 mb-6 rounded-sm font-serif text-sm" style={{backgroundColor: COLORS.redDarker, borderColor: COLORS.redBorder, borderWidth: '1px', color: COLORS.redLight}}>
          {error}
        </div>
      )}

      {/* Home ID Field */}
      <div className="mb-6 md:mb-8">
        <label className="block text-sm uppercase tracking-wider mb-2 font-serif" style={{color: COLORS.gold}}>
          Home ID
        </label>
        <input
          type="number"
          name="homeId"
          defaultValue="1"
          required
          className="w-full px-3 py-2 md:py-3 font-serif focus:outline-none focus:shadow-lg transition-all"
          style={{backgroundColor: COLORS.black, borderColor: COLORS.gold, borderWidth: '2px', color: COLORS.parchment}}
        />
      </div>

      {/* Username Field */}
      <div className="mb-6 md:mb-8">
        <label className="block text-sm uppercase tracking-wider mb-2 font-serif" style={{color: COLORS.gold}}>
          Username
        </label>
        <input
          type="text"
          name="username"
          placeholder="alice"
          required
          className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
          style={{backgroundColor: COLORS.black, borderColor: COLORS.gold, borderWidth: '2px', color: COLORS.parchment}}
        />
      </div>

      {/* Password Field */}
      <div className="mb-8 md:mb-10">
        <label className="block text-sm uppercase tracking-wider mb-2 font-serif" style={{color: COLORS.gold}}>
          Password
        </label>
        <input
          type="password"
          name="password"
          placeholder="••••••••"
          required
          className="w-full px-3 py-2 md:py-3 font-serif placeholder-opacity-50 focus:outline-none focus:shadow-lg transition-all"
          style={{backgroundColor: COLORS.black, borderColor: COLORS.gold, borderWidth: '2px', color: COLORS.parchment}}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 md:py-4 font-serif font-semibold text-sm uppercase tracking-wider transition-all duration-300 hover:shadow-lg"
        style={{
          backgroundColor: loading ? `rgba(212, 175, 55, 0.1)` : `rgba(212, 175, 55, 0.2)`,
          borderColor: COLORS.gold,
          borderWidth: '2px',
          color: COLORS.gold,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.5 : 1
        }}
      >
        {loading ? 'Logging in...' : 'Enter Quest Log'}
      </button>
    </form>
  );
}
