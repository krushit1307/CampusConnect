import os
import json
from web3 import Web3

# Initialize provider endpoint targeting Polygon Mainnet/Amoy Testnet
w3 = Web3(Web3.HTTPProvider(os.getenv("POLYGON_RPC_URL", "http://127.0.0.1:8545")))
deployer_address = os.getenv("DEPLOYER_ADDRESS")
private_key = os.getenv("DEPLOYER_PRIVATE_KEY")

def deploy_insurance_pool(token_address):
    print(f"Initializing contract deployment pipeline from account: {deployer_address}")
    
    # Load compiled interface data
    with open("./artifacts/contracts/ParametricInsurancePool.sol/ParametricInsurancePool.json") as f:
        contract_json = json.load(f)
        
    abi = contract_json["abi"]
    bytecode = contract_json["bytecode"]

    InsuranceContract = w3.eth.contract(abi=abi, bytecode=bytecode)
    
    # Build construction parameters transaction
    nonce = w3.eth.get_transaction_count(deployer_address)
    tx = InsuranceContract.constructor(token_address).build_transaction({
        'chainId': 137,  # Polygon Mainnet ID
        'gas': 3000000,
        'gasPrice': w3.eth.gas_price,
        'nonce': nonce,
    })

    signed_tx = w3.eth.account.sign_transaction(tx, private_key=private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    
    print(f"Transaction broadcasting... Hash: {tx_hash.hex()}")
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"Contract securely deployed to Polygon address: {tx_receipt.contractAddress}")
    
    return tx_receipt.contractAddress

if __name__ == "__main__":
    # Example deployment targeting Polygon USDC token instance address
    USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
    deploy_insurance_pool(USDC_POLYGON)
