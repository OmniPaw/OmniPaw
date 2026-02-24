export type AgentId = string;
export type TxId = string;
export type EphemeralHandle = string;

// INV-11: All values stored in any memory scope must be serializable to JSON
export type Value =
    | string
    | number
    | boolean
    | null
    | Value[]
    | { [key: string]: Value };

export type WriteResult = {
    success: boolean;
    txId: TxId;
    timestamp: number;
};
