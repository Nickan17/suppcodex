// Import necessary modules
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Text, View, Button } from 'react-native';
import * as Updates from 'expo-updates';

// Define props interface
interface Props {
  children: ReactNode;
}

// Define state interface
interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Global Error Boundary component
 * Catches JavaScript errors anywhere in the child component tree
 * Logs the error and displays a fallback UI
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  // Update state when an error is caught
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Log error details
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // In production, you could send this to an error reporting service
  }

  // Restart app handler
  private handleRestart = async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.error('Failed to reload app:', error);
    }
  };

  public render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 24, marginBottom: 20 }}>Something went wrong</Text>
          <Text style={{ fontSize: 16, marginBottom: 20, textAlign: 'center' }}>
            We&apos;re sorry for the inconvenience. Please try restarting the app.
          </Text>
          {!__DEV__ && (
            <Button title="Restart App" onPress={this.handleRestart} />
          )}
          {__DEV__ && this.state.error && (
            <Text style={{ fontSize: 14, color: 'red' }}>{this.state.error.message}</Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 