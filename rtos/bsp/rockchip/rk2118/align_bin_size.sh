#!/bin/bash

if [ $# -ne 1 ]; then
    echo "Usage: $0 <file_path>"
    exit 1
fi

file_path="$1"
if [ ! -f "$file_path" ]; then
    echo "Error: File does not exist!"
    exit 1
fi

file_size=$(stat --printf="%s" "$file_path")
echo "Original file size: $file_size bytes."

aligned_size=$(( (file_size + 511) / 512 * 512 ))
echo "Aligned file size: $aligned_size bytes."

if [ $file_size -ne $aligned_size ]; then
    truncate -s $aligned_size "$file_path"
    echo "File size modified to the aligned value."
else
    echo "File size is already aligned; no changes made."
fi
