export type ProblemDifficulty = "Easy" | "Medium" | "Hard";

export type Problem = {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  description: string;
  starterCode: string;
  testCases: { id: string; input: string; expectedOutput: string }[];
};

// ---------------------------------------------------------------------------
// Reusable header snippet
// ---------------------------------------------------------------------------
const H = `#include <bits/stdc++.h>
using namespace std;
`;

// ---------------------------------------------------------------------------
// Problem catalog — 20 problems covering arrays, linked-lists, stacks,
// queues, graphs, DP, binary-search, sorting, recursion, and math.
// ---------------------------------------------------------------------------
export const problems: Problem[] = [
  // ── EASY ─────────────────────────────────────────────────────────────────

  {
    id: "sum-two",
    title: "Sum of Two Numbers",
    difficulty: "Easy",
    description: "Read two integers and print their sum.",
    starterCode:
      H +
      `
int main() {
  int a, b;
  cin >> a >> b;
  cout << a + b << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "7 12\n", expectedOutput: "19\n" },
      { id: "s2", input: "-5 18\n", expectedOutput: "13\n" },
      { id: "s3", input: "100 250\n", expectedOutput: "350\n" },
    ],
  },

  {
    id: "max-of-array",
    title: "Maximum in Array",
    difficulty: "Easy",
    description: "Read N integers and print the maximum value.",
    starterCode:
      H +
      `
int main() {
  int n;
  cin >> n;
  vector<int> a(n);
  for (int& x : a) cin >> x;
  cout << *max_element(a.begin(), a.end()) << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "5\n3 1 4 1 5\n", expectedOutput: "5\n" },
      { id: "s2", input: "4\n-7 -1 -3 -2\n", expectedOutput: "-1\n" },
      { id: "s3", input: "1\n42\n", expectedOutput: "42\n" },
    ],
  },

  {
    id: "reverse-array",
    title: "Reverse an Array",
    difficulty: "Easy",
    description: "Read N numbers and print them in reverse order.",
    starterCode:
      H +
      `
int main() {
  int n;
  cin >> n;
  vector<int> a(n);
  for (int& x : a) cin >> x;
  reverse(a.begin(), a.end());
  for (int x : a) cout << x << " ";
  cout << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "5\n1 2 3 4 5\n", expectedOutput: "5 4 3 2 1 \n" },
      { id: "s2", input: "4\n9 0 -2 6\n", expectedOutput: "6 -2 0 9 \n" },
    ],
  },

  {
    id: "linear-search",
    title: "Linear Search",
    difficulty: "Easy",
    description:
      "Read N integers and a target. Print the first 0-based index where the target appears, or -1 if absent.",
    starterCode:
      H +
      `
int main() {
  int n, target;
  cin >> n >> target;
  vector<int> a(n);
  for (int& x : a) cin >> x;

  int ans = -1;
  for (int i = 0; i < n; i++) {
    if (a[i] == target) { ans = i; break; }
  }
  cout << ans << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "6 4\n1 3 4 2 4 7\n", expectedOutput: "2\n" },
      { id: "s2", input: "4 9\n1 2 3 4\n", expectedOutput: "-1\n" },
    ],
  },

  {
    id: "palindrome-check",
    title: "Palindrome Check",
    difficulty: "Easy",
    description: "Read a string and print YES if it is a palindrome, NO otherwise.",
    starterCode:
      H +
      `
int main() {
  string s;
  cin >> s;
  string rev = s;
  reverse(rev.begin(), rev.end());
  cout << (s == rev ? "YES" : "NO") << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "racecar\n", expectedOutput: "YES\n" },
      { id: "s2", input: "hello\n", expectedOutput: "NO\n" },
      { id: "s3", input: "madam\n", expectedOutput: "YES\n" },
    ],
  },

  {
    id: "count-freq",
    title: "Frequency Count",
    difficulty: "Easy",
    description:
      "Read N integers. Print each distinct value and its count, sorted by value ascending.",
    starterCode:
      H +
      `
int main() {
  int n;
  cin >> n;
  map<int, int> freq;
  for (int i = 0; i < n; i++) {
    int x; cin >> x;
    freq[x]++;
  }
  for (auto& [val, cnt] : freq) {
    cout << val << " " << cnt << "\\n";
  }
}
`,
    testCases: [
      {
        id: "s1",
        input: "7\n3 1 3 2 1 3 2\n",
        expectedOutput: "1 2\n2 2\n3 3\n",
      },
      {
        id: "s2",
        input: "3\n5 5 5\n",
        expectedOutput: "5 3\n",
      },
    ],
  },

  {
    id: "bubble-sort",
    title: "Bubble Sort",
    difficulty: "Easy",
    description:
      "Implement bubble sort on N integers and print the sorted array. Watch each swap happening step by step in the tracer.",
    starterCode:
      H +
      `
int main() {
  int n;
  cin >> n;
  vector<int> a(n);
  for (int& x : a) cin >> x;

  for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - i - 1; j++) {
      if (a[j] > a[j + 1]) swap(a[j], a[j + 1]);
    }
  }

  for (int x : a) cout << x << " ";
  cout << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "5\n5 3 8 1 2\n", expectedOutput: "1 2 3 5 8 \n" },
      { id: "s2", input: "4\n4 3 2 1\n", expectedOutput: "1 2 3 4 \n" },
    ],
  },

  // ── MEDIUM ────────────────────────────────────────────────────────────────

  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Medium",
    description:
      "Given a sorted array of N integers and a target, print the 0-based index where the target appears, or -1 if not found. Trace the lo/mid/hi pointers narrowing down.",
    starterCode:
      H +
      `
int main() {
  int n, target;
  cin >> n >> target;
  vector<int> a(n);
  for (int& x : a) cin >> x;

  int lo = 0, hi = n - 1, ans = -1;
  while (lo <= hi) {
    int mid = lo + (hi - lo) / 2;
    if (a[mid] == target) { ans = mid; break; }
    else if (a[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  cout << ans << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "7 14\n2 5 8 12 14 23 38\n", expectedOutput: "4\n" },
      { id: "s2", input: "5 10\n1 3 7 10 15\n", expectedOutput: "3\n" },
      { id: "s3", input: "4 6\n1 2 3 4\n", expectedOutput: "-1\n" },
    ],
  },

  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Medium",
    description:
      "Read a string of brackets and print YES if every bracket is properly matched, NO otherwise. Trace the stack being pushed/popped.",
    starterCode:
      H +
      `
int main() {
  string s;
  cin >> s;
  stack<char> st;
  bool ok = true;

  for (char c : s) {
    if (c == '(' || c == '[' || c == '{') {
      st.push(c);
    } else {
      if (st.empty()) { ok = false; break; }
      char top = st.top(); st.pop();
      if ((c == ')' && top != '(') ||
          (c == ']' && top != '[') ||
          (c == '}' && top != '{')) {
        ok = false; break;
      }
    }
  }
  if (!st.empty()) ok = false;
  cout << (ok ? "YES" : "NO") << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "()[]{}\n", expectedOutput: "YES\n" },
      { id: "s2", input: "([)]\n", expectedOutput: "NO\n" },
      { id: "s3", input: "{[]}\n", expectedOutput: "YES\n" },
      { id: "s4", input: "(((\n", expectedOutput: "NO\n" },
    ],
  },

  {
    id: "fibonacci",
    title: "Fibonacci Recursion",
    difficulty: "Medium",
    description:
      "Compute the N-th Fibonacci number using recursion. Trace the deep recursive call stack unwinding.",
    starterCode:
      H +
      `
int fib(int n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

int main() {
  int n;
  cin >> n;
  cout << fib(n) << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "6\n", expectedOutput: "8\n" },
      { id: "s2", input: "10\n", expectedOutput: "55\n" },
    ],
  },

  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Medium",
    description:
      "Given N integers and target T, find indices i and j (i < j) such that a[i] + a[j] == T. Print i and j, or -1 -1 if none exists.",
    starterCode:
      H +
      `
int main() {
  int n, target;
  cin >> n >> target;
  vector<int> a(n);
  for (int& x : a) cin >> x;

  unordered_map<int, int> seen;
  int ri = -1, rj = -1;
  for (int i = 0; i < n; i++) {
    int need = target - a[i];
    if (seen.count(need)) {
      ri = seen[need]; rj = i; break;
    }
    seen[a[i]] = i;
  }
  cout << ri << " " << rj << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "5 9\n2 7 11 15 1\n", expectedOutput: "0 1\n" },
      { id: "s2", input: "4 6\n1 2 3 4\n", expectedOutput: "1 3\n" },
      { id: "s3", input: "3 100\n1 2 3\n", expectedOutput: "-1 -1\n" },
    ],
  },

  {
    id: "merge-sorted",
    title: "Merge Two Sorted Arrays",
    difficulty: "Medium",
    description:
      "Read two sorted arrays of size N and M. Merge them into one sorted array and print it.",
    starterCode:
      H +
      `
int main() {
  int n, m;
  cin >> n >> m;
  vector<int> a(n), b(m), res;
  for (int& x : a) cin >> x;
  for (int& x : b) cin >> x;

  int i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] <= b[j]) res.push_back(a[i++]);
    else              res.push_back(b[j++]);
  }
  while (i < n) res.push_back(a[i++]);
  while (j < m) res.push_back(b[j++]);

  for (int x : res) cout << x << " ";
  cout << "\\n";
}
`,
    testCases: [
      {
        id: "s1",
        input: "3 4\n1 3 5\n2 4 6 8\n",
        expectedOutput: "1 2 3 4 5 6 8 \n",
      },
      {
        id: "s2",
        input: "2 2\n1 2\n3 4\n",
        expectedOutput: "1 2 3 4 \n",
      },
    ],
  },

  {
    id: "prefix-sum",
    title: "Range Sum Queries",
    difficulty: "Medium",
    description:
      "Build a prefix-sum array over N integers, then answer Q range-sum queries [l, r] (0-indexed, inclusive). Print each query answer on a new line.",
    starterCode:
      H +
      `
int main() {
  int n;
  cin >> n;
  vector<long long> a(n);
  for (auto& x : a) cin >> x;

  vector<long long> pre(n + 1, 0);
  for (int i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];

  int q;
  cin >> q;
  while (q--) {
    int l, r; cin >> l >> r;
    cout << pre[r + 1] - pre[l] << "\\n";
  }
}
`,
    testCases: [
      {
        id: "s1",
        input: "5\n2 4 6 8 10\n3\n1 3\n0 4\n2 2\n",
        expectedOutput: "18\n30\n6\n",
      },
    ],
  },

  {
    id: "prime-sieve",
    title: "Sieve of Eratosthenes",
    difficulty: "Medium",
    description:
      "Print all prime numbers up to N using the Sieve of Eratosthenes. Watch the sieve marking composites in the data-structures panel.",
    starterCode:
      H +
      `
int main() {
  int n;
  cin >> n;
  vector<bool> is_prime(n + 1, true);
  is_prime[0] = is_prime[1] = false;

  for (int i = 2; i * i <= n; i++) {
    if (is_prime[i]) {
      for (int j = i * i; j <= n; j += i)
        is_prime[j] = false;
    }
  }

  for (int i = 2; i <= n; i++)
    if (is_prime[i]) cout << i << " ";
  cout << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "20\n", expectedOutput: "2 3 5 7 11 13 17 19 \n" },
      { id: "s2", input: "10\n", expectedOutput: "2 3 5 7 \n" },
    ],
  },

  {
    id: "next-greater",
    title: "Next Greater Element",
    difficulty: "Medium",
    description:
      "For each element in the array, find the next greater element to its right. Print -1 if none exists. Use a monotonic stack.",
    starterCode:
      H +
      `
int main() {
  int n;
  cin >> n;
  vector<int> a(n);
  for (int& x : a) cin >> x;

  vector<int> ans(n, -1);
  stack<int> st; // holds indices

  for (int i = 0; i < n; i++) {
    while (!st.empty() && a[st.top()] < a[i]) {
      ans[st.top()] = a[i];
      st.pop();
    }
    st.push(i);
  }

  for (int x : ans) cout << x << " ";
  cout << "\\n";
}
`,
    testCases: [
      {
        id: "s1",
        input: "6\n4 5 2 10 8 1\n",
        expectedOutput: "5 10 10 -1 -1 -1 \n",
      },
      {
        id: "s2",
        input: "4\n3 2 1 4\n",
        expectedOutput: "4 4 4 -1 \n",
      },
    ],
  },

  {
    id: "power-recursive",
    title: "Fast Power (Recursive)",
    difficulty: "Medium",
    description:
      "Compute base^exp using recursive fast exponentiation. The call depth is O(log exp) — great for tracing.",
    starterCode:
      H +
      `
long long power(long long base, int exp) {
  if (exp == 0) return 1;
  long long half = power(base, exp / 2);
  if (exp % 2 == 0) return half * half;
  return base * half * half;
}

int main() {
  long long b; int e;
  cin >> b >> e;
  cout << power(b, e) << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "2 10\n", expectedOutput: "1024\n" },
      { id: "s2", input: "3 5\n", expectedOutput: "243\n" },
      { id: "s3", input: "7 0\n", expectedOutput: "1\n" },
    ],
  },

  // ── HARD ─────────────────────────────────────────────────────────────────

  {
    id: "merge-sort",
    title: "Merge Sort",
    difficulty: "Hard",
    description:
      "Sort N integers using merge sort. Trace the recursive splitting and merging of sub-arrays in the call stack.",
    starterCode:
      H +
      `
void merge(vector<int>& a, int l, int m, int r) {
  vector<int> left(a.begin() + l, a.begin() + m + 1);
  vector<int> right(a.begin() + m + 1, a.begin() + r + 1);
  int i = 0, j = 0, k = l;
  while (i < (int)left.size() && j < (int)right.size())
    a[k++] = (left[i] <= right[j]) ? left[i++] : right[j++];
  while (i < (int)left.size())  a[k++] = left[i++];
  while (j < (int)right.size()) a[k++] = right[j++];
}

void mergeSort(vector<int>& a, int l, int r) {
  if (l >= r) return;
  int m = l + (r - l) / 2;
  mergeSort(a, l, m);
  mergeSort(a, m + 1, r);
  merge(a, l, m, r);
}

int main() {
  int n; cin >> n;
  vector<int> a(n);
  for (int& x : a) cin >> x;
  mergeSort(a, 0, n - 1);
  for (int x : a) cout << x << " ";
  cout << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "6\n5 2 8 3 9 1\n", expectedOutput: "1 2 3 5 8 9 \n" },
      { id: "s2", input: "4\n4 3 2 1\n", expectedOutput: "1 2 3 4 \n" },
    ],
  },

  {
    id: "longest-common-subsequence",
    title: "Longest Common Subsequence",
    difficulty: "Hard",
    description:
      "Compute the length of the LCS of two strings using bottom-up DP. Observe the full DP table fill in the locals panel.",
    starterCode:
      H +
      `
int main() {
  string a, b;
  cin >> a >> b;
  int n = a.size(), m = b.size();
  vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));

  for (int i = 1; i <= n; i++) {
    for (int j = 1; j <= m; j++) {
      if (a[i-1] == b[j-1]) dp[i][j] = dp[i-1][j-1] + 1;
      else dp[i][j] = max(dp[i-1][j], dp[i][j-1]);
    }
  }
  cout << dp[n][m] << "\\n";
}
`,
    testCases: [
      { id: "s1", input: "ABCBDAB\nBDCAB\n", expectedOutput: "4\n" },
      { id: "s2", input: "AGGTAB\nGXTXAYB\n", expectedOutput: "4\n" },
    ],
  },

  {
    id: "knapsack-01",
    title: "0-1 Knapsack",
    difficulty: "Hard",
    description:
      "Given N items each with a weight and value, and a knapsack of capacity W, find the maximum value achievable without exceeding W.",
    starterCode:
      H +
      `
int main() {
  int n, W;
  cin >> n >> W;
  vector<int> wt(n), val(n);
  for (int i = 0; i < n; i++) cin >> wt[i] >> val[i];

  vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));
  for (int i = 1; i <= n; i++) {
    for (int w = 0; w <= W; w++) {
      dp[i][w] = dp[i-1][w];
      if (wt[i-1] <= w)
        dp[i][w] = max(dp[i][w], dp[i-1][w - wt[i-1]] + val[i-1]);
    }
  }
  cout << dp[n][W] << "\\n";
}
`,
    testCases: [
      {
        id: "s1",
        input: "4 7\n2 3\n3 4\n4 5\n5 8\n",
        expectedOutput: "13\n",
      },
      {
        id: "s2",
        input: "3 4\n1 1\n3 4\n4 5\n",
        expectedOutput: "5\n",
      },
    ],
  },

  {
    id: "bfs-shortest-path",
    title: "BFS Shortest Path",
    difficulty: "Hard",
    description:
      "Given a graph with V vertices and E edges (0-indexed, undirected), find the shortest-path distance from vertex 0 to all others. Print -1 for unreachable vertices.",
    starterCode:
      H +
      `
int main() {
  int V, E;
  cin >> V >> E;
  vector<vector<int>> adj(V);
  for (int i = 0; i < E; i++) {
    int u, v; cin >> u >> v;
    adj[u].push_back(v);
    adj[v].push_back(u);
  }

  vector<int> dist(V, -1);
  queue<int> q;
  dist[0] = 0;
  q.push(0);

  while (!q.empty()) {
    int u = q.front(); q.pop();
    for (int w : adj[u]) {
      if (dist[w] == -1) {
        dist[w] = dist[u] + 1;
        q.push(w);
      }
    }
  }

  for (int i = 0; i < V; i++)
    cout << dist[i] << " ";
  cout << "\\n";
}
`,
    testCases: [
      {
        id: "s1",
        input: "5 5\n0 1\n0 2\n1 3\n2 3\n3 4\n",
        expectedOutput: "0 1 1 2 3 \n",
      },
      {
        id: "s2",
        input: "4 3\n0 1\n0 2\n2 3\n",
        expectedOutput: "0 1 1 2 \n",
      },
    ],
  },

  {
    id: "dfs-connected-components",
    title: "DFS Connected Components",
    difficulty: "Hard",
    description:
      "Given a graph with V vertices and E edges (undirected), count the number of connected components. Trace the DFS recursion and visited array.",
    starterCode:
      H +
      `
vector<vector<int>> adj;
vector<bool> visited;

void dfs(int u) {
  visited[u] = true;
  for (int v : adj[u]) {
    if (!visited[v]) dfs(v);
  }
}

int main() {
  int V, E;
  cin >> V >> E;
  adj.assign(V, {});
  visited.assign(V, false);

  for (int i = 0; i < E; i++) {
    int u, v; cin >> u >> v;
    adj[u].push_back(v);
    adj[v].push_back(u);
  }

  int components = 0;
  for (int i = 0; i < V; i++) {
    if (!visited[i]) {
      dfs(i);
      components++;
    }
  }
  cout << components << "\\n";
}
`,
    testCases: [
      {
        id: "s1",
        input: "6 4\n0 1\n1 2\n3 4\n4 5\n",
        expectedOutput: "2\n",
      },
      {
        id: "s2",
        input: "5 0\n",
        expectedOutput: "5\n",
      },
      {
        id: "s3",
        input: "4 4\n0 1\n1 2\n2 3\n3 0\n",
        expectedOutput: "1\n",
      },
    ],
  },
];