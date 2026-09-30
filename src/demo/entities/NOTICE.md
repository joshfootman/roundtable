# Source 2 entity protocol references

The native TypeScript decoder in this directory adapts Source 2 bit encodings, Huffman field-path operations and quantized-float algorithms from `sendtables2` in [demoinfocs-golang v4.5.1](https://github.com/markus-wa/demoinfocs-golang/tree/v4.5.1/pkg/demoinfocs/sendtables2). The reference credits the earlier [dotabuff/manta](https://github.com/dotabuff/manta) decoder. The TypeScript implementation owns its serializer registry, entity state and replay projection. Neither reference parser runs in the application.

MIT License

Copyright (c) 2017-2024 Markus Walther

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
