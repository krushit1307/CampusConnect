diff --git a/D3.js b/D3.js
new file mode 100644
--- /dev/null
@@ -0,0 +1,20 @@
+import * as d3 from 'd3';
+
+// Function to create the dietary restrictions aggregation dashboard
+function createDietaryRestrictionsDashboard(data) {
+  // Create SVG element
+  const svg = d3.select('body').append('svg')
+    .attr('width', 800)
+    .attr('height', 600);
+
+  // Data processing and aggregation logic here
+  const groupedData = d3.group(data, d => d.restriction);
+
+  // Create bars for each dietary restriction
+  svg.selectAll('.bar')
+    .data(groupedData)
+    .enter().append('rect')
+      .attr('class', 'bar')
+      .attr('x', (d, i) => i * 100 + 50)
+      .attr('y', d => 600 - d[1].length * 20)
+      .attr('width', 80)
+      .attr('height', d => d[1].length * 20);
+}
+
+// Example usage
+const data = [
+  { food: 'Pizza', restriction: 'Gluten' },
+  { food: 'Sushi', restriction: 'Fish' },
+  { food: 'Burger', restriction: 'Gluten' }
+];
+createDietaryRestrictionsDashboard(data);
