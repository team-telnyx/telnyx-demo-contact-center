import React, {useState, useEffect} from 'react';
import { Container, Grid, Table, TableBody, TableCell, TableHead, TableRow, Button } from '@mui/material';
import axios from 'axios';
import { useAuth } from './AuthContext';

const MainContent = ({ isOpen }) => {
  const { isLoggedIn, username } = useAuth();
  const marginLeft = isOpen ? '240px' : '64px';

  if (!isLoggedIn) {
    return (
      <div style={{ marginTop: '64px', marginLeft }}>
        <h1>Please login to access this page.</h1>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '64px', marginLeft }}>
      <h1>Agent Dashboard</h1>
      <hr />
      <Grid container>
      </Grid>
    </div>
  );

};

export default MainContent;
