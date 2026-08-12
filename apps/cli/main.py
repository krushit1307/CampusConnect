--- a/apps/cli/main.py
@@ -10,6 +10,8 @@
 def main():
     print("Welcome to the CLI application!")
 
+    search_bar()
+
 def list_commands():
     commands = ["command1", "command2", "command3"]
     for command in commands:
@@ -20,4 +22,12 @@
 
 if __name__ == "__main__":
     main()
+
+def search_bar():
+    print("Search bar activated. Type your query:")
+    query = input()
+    if query.lower() == "commands":
+        list_commands()
+    else:
+        print(f"No results found for: {query}")
