import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export function BrandedHeader() {
  const { pathname } = useLocation();
  const isAuthPage = /^\/(login|forgot-password|reset-password|verify-[^/]+|password-decision|change-password|account-access|privacy-notice)(\/|$)/.test(pathname);

  return (
    <header className="sticky top-0 z-50 bg-white border-b-2 border-[#D4AF37] shadow-sm w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left branding */}
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img 
            src="/pup-logo.png" 
            alt="PUP Logo" 
            className="h-14 w-14 object-contain"
          />
          <div className="flex flex-col text-left">
            <span
              className="font-bold text-[#800000] text-sm sm:text-lg lg:text-xl leading-tight uppercase"
              style={{ fontFamily: '"Trajan Pro", "Times New Roman", serif' }}
            >
              Polytechnic University of the Philippines
            </span>
            <span className="text-xs sm:text-sm text-slate-500 font-medium">
              InTrack - OJT Monitoring System
            </span>
          </div>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-4 sm:gap-6">
          {!isAuthPage && <Link 
            to="/login" 
            className="inline-flex items-center justify-center rounded-md bg-[#800000] px-4 py-2 text-sm sm:text-base font-semibold text-white shadow-sm border border-[#D4AF37]/70 transition-colors hover:bg-[#6b0000] hover:border-[#D4AF37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2"
          >
            Login
          </Link>}
        </div>
      </div>
    </header>
  );
}
