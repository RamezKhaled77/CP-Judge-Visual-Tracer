export type Problem = {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  starterCode: string;
  testCases: { id: string; input: string; expectedOutput: string }[];
};

const header = `#include <bits/stdc++.h>
using namespace std;

int main() {
`;
const footer = `}
`;

export const problems: Problem[] = [
  {
    id: "sum-two",
    title: "Sum of Two Numbers",
    difficulty: "warm-up",
    description: "Read two integers and print their sum.",
    starterCode: `${header}  int a, b;\n  cin >> a >> b;\n  cout << a + b << "\\n";\n${footer}`,
    testCases: [
      { id: "sample-01", input: "7 12\n", expectedOutput: "19\n" },
      { id: "sample-02", input: "-5 18\n", expectedOutput: "13\n" },
      { id: "sample-03", input: "100 250\n", expectedOutput: "350\n" },
    ],
  },
  {
    id: "reverse-array",
    title: "Reverse an Array",
    difficulty: "easy",
    description: "Read n numbers and print them in reverse order.",
    starterCode: `${header}  int n;\n  cin >> n;\n  vector<int> a(n);\n  for (int &x : a) cin >> x;\n  reverse(a.begin(), a.end());\n  for (int x : a) cout << x << " ";\n${footer}`,
    testCases: [
      { id: "sample-01", input: "5\n1 2 3 4 5\n", expectedOutput: "5 4 3 2 1 " },
      { id: "sample-02", input: "4\n9 0 -2 6\n", expectedOutput: "6 -2 0 9 " },
    ],
  },
  {
    id: "fibonacci",
    title: "Fibonacci Recursion",
    difficulty: "medium",
    description: "Compute the n-th Fibonacci number using recursion.",
    starterCode: `#include <bits/stdc++.h>\nusing namespace std;\n\nint fib(int n) {\n  if (n <= 1) return n;\n  return fib(n - 1) + fib(n - 2);\n}\n\nint main() {\n  int n;\n  cin >> n;\n  cout << fib(n) << "\\n";\n}\n`,
    testCases: [
      { id: "sample-01", input: "6\n", expectedOutput: "8\n" },
      { id: "sample-02", input: "10\n", expectedOutput: "55\n" },
    ],
  },
];