import { FacilityNode, VenueLayout } from '@/types/venue';

/**
 * Serializes an array of FacilityNode objects into a JSON string for database storage.
 * Ensures all coordinates are snapped to the defined grid size.
 * 
 * @param nodes - Array of FacilityNode objects
 * @param gridSize - The grid size to snap to
 * @returns string - JSON serialized string of snapped nodes
 */
export function serializeFacilities(nodes: FacilityNode[], gridSize: number): string {
    const snappedNodes = nodes.map(node => ({
        ...node,
        x: Math.round(node.x / gridSize) * gridSize,
        y: Math.round(node.y / gridSize) * gridSize,
        rotation: Math.round(node.rotation / 15) * 15, // Snap rotation to 15-degree increments
    }));

    return JSON.stringify(snappedNodes);
}

/**
 * Deserializes a JSON string from the database back into an array of FacilityNode objects.
 * 
 * @param jsonString - JSON string from database
 * @returns FacilityNode[] - Parsed array of facility nodes
 */
export function deserializeFacilities(jsonString: string): FacilityNode[] {
    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
            return parsed as FacilityNode[];
        }
        return [];
    } catch (error) {
        console.error('Failed to deserialize facility nodes:', error);
        return [];
    }
}

/**
 * Validates that a facility node is within the bounds of the canvas.
 * 
 * @param node - The node to validate
 * @param canvasWidth - Maximum allowed X coordinate
 * @param canvasHeight - Maximum allowed Y coordinate
 * @returns boolean - True if valid, false otherwise
 */
export function validateNodeBounds(
    node: FacilityNode,
    canvasWidth: number,
    canvasHeight: number
): boolean {
    return (
        node.x >= 0 &&
        node.y >= 0 &&
        node.x + node.width <= canvasWidth &&
        node.y + node.height <= canvasHeight
    );
}
