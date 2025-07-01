import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { ethers } from 'ethers';

interface CanaryStatus {
  timestamp: number;
  messageHash: string;
  ipfsHash: string;
  active: boolean;
  stale: boolean;
  compromised: boolean;
  emergency: boolean;
}

interface WarrantCanaryProps {
  contractAddress?: string;
  rpcUrl?: string;
  showDetails?: boolean;
  onStatusChange?: (status: CanaryStatus) => void;
}

export const WarrantCanary: React.FC<WarrantCanaryProps> = ({
  contractAddress = process.env.EXPO_PUBLIC_CANARY_CONTRACT_ADDRESS,
  rpcUrl = process.env.EXPO_PUBLIC_RPC_URL || 'https://rpc.sepolia.org',
  showDetails = true,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<CanaryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const contractABI = [
    "function getCanaryStatus() view returns (uint256 timestamp, bytes32 messageHash, string ipfsHash, bool active, bool stale, bool compromised, bool emergency)",
    "function daysSinceLastUpdate() view returns (uint256)",
    "function isStale() view returns (bool)"
  ];

  useEffect(() => {
    fetchCanaryStatus();
    
    // Set up periodic status checks (every 5 minutes)
    const interval = setInterval(fetchCanaryStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchCanaryStatus = async () => {
    if (!contractAddress || !rpcUrl) {
      setError('Contract address or RPC URL not configured');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(contractAddress, contractABI, provider);

      const result = await contract.getCanaryStatus();
      
      const canaryStatus: CanaryStatus = {
        timestamp: Number(result.timestamp),
        messageHash: result.messageHash,
        ipfsHash: result.ipfsHash,
        active: result.active,
        stale: result.stale,
        compromised: result.compromised,
        emergency: result.emergency,
      };

      setStatus(canaryStatus);
      setLastChecked(new Date());
      
      if (onStatusChange) {
        onStatusChange(canaryStatus);
      }

    } catch (err) {
      console.error('Failed to fetch canary status:', err);
      setError('Failed to check canary status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (): string => {
    if (!status) return '#666';
    if (status.compromised || status.emergency) return '#FF3B30';
    if (status.stale) return '#FF9500';
    if (status.active) return '#34C759';
    return '#666';
  };

  const getStatusText = (): string => {
    if (!status) return 'Unknown';
    if (status.compromised) return 'COMPROMISED';
    if (status.emergency) return 'EMERGENCY';
    if (status.stale) return 'STALE';
    if (status.active) return 'ACTIVE';
    return 'INACTIVE';
  };

  const getStatusDescription = (): string => {
    if (!status) return 'Unable to determine canary status';
    if (status.compromised) return 'Platform may be under legal compulsion';
    if (status.emergency) return 'Emergency mode activated';
    if (status.stale) return 'Canary has not been updated recently';
    if (status.active) return 'All systems operating normally';
    return 'Canary system inactive';
  };

  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const handleViewOnIPFS = () => {
    if (status?.ipfsHash) {
      const ipfsUrl = `https://ipfs.io/ipfs/${status.ipfsHash}`;
      Linking.openURL(ipfsUrl);
    }
  };

  const handleViewOnBlockchain = () => {
    if (contractAddress) {
      const etherscanUrl = `https://sepolia.etherscan.io/address/${contractAddress}`;
      Linking.openURL(etherscanUrl);
    }
  };

  const handleRefresh = () => {
    fetchCanaryStatus();
  };

  const showAlert = () => {
    if (!status) return;

    const alertTitle = `Warrant Canary: ${getStatusText()}`;
    const alertMessage = `${getStatusDescription()}\n\nLast Updated: ${formatTimestamp(status.timestamp)}`;

    Alert.alert(
      alertTitle,
      alertMessage,
      [
        { text: 'Refresh', onPress: handleRefresh },
        { text: 'View Details', onPress: () => showDetails && handleViewOnIPFS() },
        { text: 'OK', style: 'default' }
      ]
    );
  };

  if (loading && !status) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#666" />
        <Text style={styles.loadingText}>Checking canary status...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={[styles.statusIndicator, { backgroundColor: '#FF3B30' }]} />
        <Text style={styles.statusText}>Canary Error</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={showAlert}>
      <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
      <View style={styles.textContainer}>
        <Text style={styles.statusText}>Warrant Canary: {getStatusText()}</Text>
        {showDetails && (
          <Text style={styles.detailText}>
            Last updated: {formatTimestamp(status?.timestamp || 0)}
          </Text>
        )}
      </View>
      {loading && <ActivityIndicator size="small" color="#666" />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  refreshButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  refreshText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
});

export default WarrantCanary; 