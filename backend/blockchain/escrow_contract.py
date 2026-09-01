"""
Escrow Smart Contract Integration
Blockchain integration for escrow slashing and fund management.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

from backend.models.escrow_models import (
    EscrowContract, EscrowTransaction, EscrowSlashEvent,
    EscrowStatus, OracleConsensus
)

logger = logging.getLogger(__name__)


class EscrowContractManager:
    """
    Manages escrow smart contract interactions.
    """

    def __init__(self):
        self._contracts: Dict[str, EscrowContract] = {}
        self._transactions: Dict[str, EscrowTransaction] = {}
        self._slash_events: Dict[str, EscrowSlashEvent] = {}

    def create_escrow_contract(
        self,
        vendor_id: str,
        client_id: str,
        amount: float,
        expected_delivery_time: datetime,
        temperature_threshold: float = 140.0,
        integrity_threshold: float = 90.0,
        max_delay_minutes: int = 15,
        currency: str = "USDC",
        metadata: Dict[str, Any] = None
    ) -> EscrowContract:
        """
        Create a new escrow contract.
        
        Args:
            vendor_id: Vendor ID
            client_id: Client ID
            amount: Escrow amount
            expected_delivery_time: Expected delivery time
            temperature_threshold: Temperature threshold in Fahrenheit
            integrity_threshold: Integrity score threshold
            max_delay_minutes: Maximum allowed delay
            currency: Currency
            metadata: Additional metadata
        
        Returns:
            EscrowContract object
        """
        contract = EscrowContract(
            vendor_id=vendor_id,
            client_id=client_id,
            amount=amount,
            currency=currency,
            expected_delivery_time=expected_delivery_time,
            temperature_threshold=temperature_threshold,
            integrity_threshold=integrity_threshold,
            max_delay_minutes=max_delay_minutes,
            status=EscrowStatus.PENDING,
            metadata=metadata or {}
        )
        
        self._contracts[contract.id] = contract
        logger.info(f"Created escrow contract {contract.id} for ${amount} {currency}")
        return contract

    def activate_contract(
        self,
        contract_id: str,
        contract_address: str,
        tx_hash: str,
        block_number: int
    ) -> Optional[EscrowContract]:
        """
        Activate an escrow contract on the blockchain.
        
        Args:
            contract_id: Contract ID
            contract_address: Smart contract address
            tx_hash: Transaction hash
            block_number: Block number
        
        Returns:
            Updated EscrowContract object
        """
        contract = self._contracts.get(contract_id)
        if not contract:
            return None

        contract.contract_address = contract_address
        contract.tx_hash = tx_hash
        contract.block_number = block_number
        contract.status = EscrowStatus.ACTIVE
        contract.updated_at = datetime.now()

        logger.info(f"Activated escrow contract {contract_id} at {contract_address}")
        return contract

    def process_escrow_release(
        self,
        contract_id: str,
        consensus: OracleConsensus
    ) -> Dict[str, Any]:
        """
        Process escrow release based on consensus.
        
        Args:
            contract_id: Contract ID
            consensus: Oracle consensus result
        
        Returns:
            Processing result
        """
        contract = self._contracts.get(contract_id)
        if not contract:
            return {
                'success': False,
                'message': 'Contract not found'
            }

        if contract.status != EscrowStatus.ACTIVE:
            return {
                'success': False,
                'message': f'Contract is not active (status: {contract.status.value})'
            }

        contract.oracle_consensus = consensus

        if consensus.all_approved:
            # Release funds
            contract.status = EscrowStatus.COMPLETED
            contract.completed_at = datetime.now()
            
            transaction = EscrowTransaction(
                escrow_id=contract_id,
                from_address=contract.contract_address,
                to_address=contract.vendor_id,
                amount=contract.amount,
                transaction_type="release",
                status="completed"
            )
            self._transactions[transaction.id] = transaction
            
            return {
                'success': True,
                'action': 'RELEASE',
                'message': 'Funds released successfully',
                'amount': contract.amount,
                'transaction_id': transaction.id
            }
        else:
            # Slash funds
            contract.status = EscrowStatus.SLASHED
            
            slash_event = EscrowSlashEvent(
                escrow_id=contract_id,
                slashed_amount=contract.amount,
                reason=consensus.rejection_reason or 'Oracle validation failed',
                oracle_type='multi_modal',
                evidence={
                    'temperature_status': consensus.temperature_status.value,
                    'vision_status': consensus.vision_status.value,
                    'time_status': consensus.time_status.value
                }
            )
            self._slash_events[slash_event.id] = slash_event
            
            return {
                'success': True,
                'action': 'SLASH',
                'message': f'Funds slashed: {consensus.rejection_reason}',
                'amount': contract.amount,
                'slash_event_id': slash_event.id
            }

    def get_contract(self, contract_id: str) -> Optional[EscrowContract]:
        """Get an escrow contract by ID."""
        return self._contracts.get(contract_id)

    def get_contracts_by_vendor(self, vendor_id: str) -> list:
        """Get all contracts for a vendor."""
        return [c for c in self._contracts.values() if c.vendor_id == vendor_id]

    def get_contracts_by_client(self, client_id: str) -> list:
        """Get all contracts for a client."""
        return [c for c in self._contracts.values() if c.client_id == client_id]

    def get_contract_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about escrow contracts.
        
        Returns:
            Statistics dictionary
        """
        contracts = list(self._contracts.values())
        
        if not contracts:
            return {
                'total': 0,
                'pending': 0,
                'active': 0,
                'completed': 0,
                'slashed': 0,
                'disputed': 0,
                'total_value': 0.0
            }

        return {
            'total': len(contracts),
            'pending': sum(1 for c in contracts if c.status == EscrowStatus.PENDING),
            'active': sum(1 for c in contracts if c.status == EscrowStatus.ACTIVE),
            'completed': sum(1 for c in contracts if c.status == EscrowStatus.COMPLETED),
            'slashed': sum(1 for c in contracts if c.status == EscrowStatus.SLASHED),
            'disputed': sum(1 for c in contracts if c.status == EscrowStatus.DISPUTED),
            'total_value': sum(c.amount for c in contracts)
        }

    def get_slash_events(self, contract_id: str = None) -> list:
        """Get slash events."""
        events = list(self._slash_events.values())
        if contract_id:
            events = [e for e in events if e.escrow_id == contract_id]
        return events

    def get_transactions(self, contract_id: str = None) -> list:
        """Get transactions."""
        transactions = list(self._transactions.values())
        if contract_id:
            transactions = [t for t in transactions if t.escrow_id == contract_id]
        return transactions