import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaMicrophone, FaRobot, FaBars, FaTimes } from 'react-icons/fa';
import './Sidebar.css';

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const closeSidebar = () => {
    setIsExpanded(false);
  };

  return (
    <div className={`sidebar ${isExpanded ? 'expanded' : ''}`}>
      <div className="sidebar-toggle" onClick={toggleSidebar}>
        {isExpanded ? <FaTimes /> : <FaBars />}
      </div>
      
      <div className="sidebar-content">
        <div className="sidebar-header">
          <h3>Modos</h3>
        </div>
        <nav className="sidebar-menu">
          <Link 
            to="/" 
            className={location.pathname === '/' ? 'active' : ''}
            onClick={closeSidebar}
          >
            <FaMicrophone className="menu-icon" />
            <span className="menu-text">Manual</span>
          </Link>
          <Link 
            to="/auto" 
            className={location.pathname === '/auto' ? 'active' : ''}
            onClick={closeSidebar}
          >
            <FaRobot className="menu-icon" />
            <span className="menu-text">Automático</span>
          </Link>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
