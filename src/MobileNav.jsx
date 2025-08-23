// MobileNav.js - Create this as a new file
import React, { useState } from 'react';
import { Menu, X, ArrowLeft } from 'lucide-react';

const MobileNav = ({ 
  tabs, 
  activeTab, 
  onTabChange,
  selectedSite,
  onBackToSites,
  materialType = 'Material',
  materialIcon: MaterialIcon,
  materialColor = 'blue'
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getCurrentTabInfo = () => {
    const currentTab = tabs.find(tab => tab.id === activeTab);
    if (!currentTab) return { label: 'Menu', icon: Menu };
    
    return {
      label: currentTab.label || currentTab.fullLabel,
      icon: currentTab.icon
    };
  };

  const currentTab = getCurrentTabInfo();
  const IconComponent = currentTab.icon;

  const colorClasses = {
    blue: {
      border: 'border-blue-500',
      text: 'text-blue-600',
      bg: 'bg-blue-50',
      bgActive: 'bg-blue-50',
      textActive: 'text-blue-600',
      borderActive: 'border-blue-500'
    },
    green: {
      border: 'border-green-500',
      text: 'text-green-600',
      bg: 'bg-green-50',
      bgActive: 'bg-green-50',
      textActive: 'text-green-600',
      borderActive: 'border-green-500'
    },
    orange: {
      border: 'border-orange-500',
      text: 'text-orange-600',
      bg: 'bg-orange-50',
      bgActive: 'bg-orange-50',
      textActive: 'text-orange-600',
      borderActive: 'border-orange-500'
    },
    yellow: {
      border: 'border-yellow-500',
      text: 'text-yellow-600',
      bg: 'bg-yellow-50',
      bgActive: 'bg-yellow-50',
      textActive: 'text-yellow-600',
      borderActive: 'border-yellow-500'
    }
  };

  const colors = colorClasses[materialColor] || colorClasses.blue;

  return (
    <div className="space-y-4">
      {/* Back to Sites Button */}
      {onBackToSites && (
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToSites}
            className={`flex items-center gap-2 ${colors.text} hover:text-opacity-80 font-medium`}
          >
            <ArrowLeft size={20} />
            Back to Sites
          </button>
        </div>
      )}
      
      {/* Site Header */}
      {selectedSite && MaterialIcon && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MaterialIcon size={24} className={colors.text} />
                {materialType} Inventory Management
              </h1>
              <p className={`text-lg ${colors.text} font-medium`}>
                {selectedSite?.site_name} ({selectedSite?.site_code})
              </p>
            </div>
            <span className="text-green-600 text-sm">🔄 Live Database</span>
          </div>
        </div>
      )}

      {/* Mobile-friendly Navigation */}
      <div className="bg-white rounded-lg shadow">
        {/* Mobile View */}
        <div className="block sm:hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <IconComponent size={18} className={colors.text} />
              <span className="font-medium text-gray-900">{currentTab.label}</span>
            </div>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          
          {/* Mobile dropdown menu */}
          {isMenuOpen && (
            <div className="border-b bg-gray-50">
              <div className="py-2">
                {tabs.map(tab => {
                  const TabIcon = tab.icon;
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        onTabChange(tab.id);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isActive 
                          ? `${colors.bgActive} ${colors.textActive} border-r-2 ${colors.borderActive}` 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <TabIcon size={18} />
                      <span className="font-medium">{tab.label || tab.fullLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Desktop View - Keep original horizontal tabs */}
        <div className="hidden sm:block">
          <div className="flex border-b overflow-x-auto">
            {tabs.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap transition-colors ${
                    isActive 
                      ? `border-b-2 ${colors.border} ${colors.text}` 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <TabIcon size={18} />
                  <span className="hidden sm:inline">{tab.fullLabel || tab.label}</span>
                  <span className="sm:hidden">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileNav;