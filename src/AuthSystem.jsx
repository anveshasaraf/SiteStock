import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Building, MessageSquare, AlertTriangle, CheckCircle, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { supabase } from './supabaseClient';

// Main Authentication Component
const AuthSystem = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alerts, setAlerts] = useState([]);

  // Login form state
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });

  // Registration form state
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    companyName: '',
    accessReason: ''
  });

  const addAlert = (message, type) => {
    const alert = { id: Date.now(), message, type };
    setAlerts(prev => [alert, ...prev.slice(0, 2)]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== alert.id)), 5000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password
      });

      if (authError) throw authError;

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single();

      if (profileError) {
        // If no profile exists, create one
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert([{
            auth_user_id: authData.user.id,
            email: authData.user.email,
            full_name: authData.user.email.split('@')[0], // Use email prefix as temp name
            status: 'pending'
          }])
          .select()
          .single();

        if (createError) {
          addAlert('Error creating profile. Please contact administrator.', 'error');
          return;
        }

        addAlert('Account created but pending approval. Please wait for admin approval.', 'warning');
        await supabase.auth.signOut();
        return;
      }

      // Check account status
      if (profile.status === 'pending') {
        addAlert('Your account is pending approval. Please wait for admin approval.', 'warning');
        await supabase.auth.signOut();
        return;
      }

      if (profile.status === 'rejected') {
        addAlert('Your account has been rejected. Please contact administrator.', 'error');
        await supabase.auth.signOut();
        return;
      }

      if (profile.status === 'suspended') {
        addAlert('Your account has been suspended. Please contact administrator.', 'error');
        await supabase.auth.signOut();
        return;
      }

      // Update last login
      await supabase
        .from('user_profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', profile.id);

      addAlert('Login successful!', 'success');
      console.log('About to call onAuthSuccess with:', { authData: authData.user, profile });
      
      if (typeof onAuthSuccess === 'function') {
        await onAuthSuccess(authData.user, profile);
      } else {
        console.error('onAuthSuccess is not a function:', onAuthSuccess);
        addAlert('Navigation error - please refresh the page', 'error');
      }

    } catch (error) {
      addAlert(error.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form
      if (registerForm.password !== registerForm.confirmPassword) {
        addAlert('Passwords do not match', 'error');
        return;
      }

      if (registerForm.password.length < 6) {
        addAlert('Password must be at least 6 characters', 'error');
        return;
      }

      if (!registerForm.fullName.trim() || !registerForm.accessReason.trim()) {
        addAlert('Please fill all required fields', 'error');
        return;
      }

      // Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: registerForm.email,
        password: registerForm.password
      });

      if (authError) throw authError;

      // Wait a moment for trigger to potentially create profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if profile exists (created by trigger)
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', authData.user.id)
        .single();

      if (!existingProfile) {
        // Profile doesn't exist, create it manually
        const profileData = {
          email: registerForm.email,
          full_name: registerForm.fullName.trim(),
          phone: registerForm.phone.trim() || null,
          company_name: registerForm.companyName.trim() || null,
          requested_access_reason: registerForm.accessReason.trim(),
          status: 'pending',
          role: 'user'
        };

        // Only add auth_user_id if it exists
        if (authData.user && authData.user.id) {
          profileData.auth_user_id = authData.user.id;
        }

        console.log('Attempting to create profile with data:', profileData);

        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([profileData]);

        if (profileError) {
          console.log('Profile creation error details:', {
            error: profileError,
            code: profileError.code,
            message: profileError.message,
            details: profileError.details
          });
          addAlert('Database error: ' + profileError.message, 'error');
          return;
        }
      } else {
        // Profile exists (created by trigger), update it with additional info
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            full_name: registerForm.fullName.trim(),
            phone: registerForm.phone.trim(),
            company_name: registerForm.companyName.trim(),
            requested_access_reason: registerForm.accessReason.trim()
          })
          .eq('auth_user_id', authData.user.id);

        if (updateError) {
          console.log('Profile update error:', updateError);
        }
      }

      addAlert('Registration successful! Your account is pending approval. You will be notified once approved.', 'success');
      
      // Reset form and switch to login
      setRegisterForm({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        phone: '',
        companyName: '',
        accessReason: ''
      });
      setIsLogin(true);

    } catch (error) {
      addAlert(error.message || 'Registration failed', 'error');
      console.log('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Alerts */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {alerts.map(alert => (
            <div key={alert.id} className={`p-3 rounded-lg shadow-lg max-w-sm ${
              alert.type === 'success' ? 'bg-green-500 text-white' :
              alert.type === 'error' ? 'bg-red-500 text-white' :
              'bg-yellow-500 text-white'
            }`}>
              <div className="flex items-center gap-2">
                {alert.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <span className="text-sm">{alert.message}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Building className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Construction Management</h1>
          <p className="text-gray-600 mt-2">Inventory & Site Management System</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-lg shadow-xl p-6">
          {/* Toggle Buttons */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                isLogin 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                !isLogin 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Sign Up
            </button>
          </div>

          {/* Login Form */}
          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing In...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      required
                      value={registerForm.fullName}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="tel"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={registerForm.companyName}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, companyName: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ABC Construction Co."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Min 6 characters"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Why do you need access? *
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 text-gray-400" size={16} />
                  <textarea
                    required
                    value={registerForm.accessReason}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, accessReason: e.target.value }))}
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Explain why you need access to the construction management system..."
                  />
                </div>
              </div>

              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  {showPassword ? <EyeOff size={14} className="mr-1" /> : <Eye size={14} className="mr-1" />}
                  {showPassword ? 'Hide' : 'Show'} passwords
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating Account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Your account will be reviewed and approved by an administrator
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthSystem;