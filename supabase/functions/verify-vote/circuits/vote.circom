pragma circom 2.1.0;

template Vote() {
    signal input secret;
    signal input electionId;
    signal input voteChoice;
    signal output nullifier;

    signal secretHash;
    signal combined;

    combined <== secret + electionId;
    secretHash <== combined * combined;
    nullifier <== secretHash + voteChoice;
}

component main = Vote();
