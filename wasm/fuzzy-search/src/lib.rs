use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SearchEngine {
    dataset: Vec<u8>,
    records: Vec<u32>,
    results: Vec<u32>,
}

#[wasm_bindgen]
impl SearchEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(dataset_str: &str) -> SearchEngine {
        let dataset = dataset_str.as_bytes().to_vec();
        let mut records = Vec::new();
        let mut start = 0;
        
        for (i, &b) in dataset.iter().enumerate() {
            if b == b'\0' {
                records.push(start as u32);
                records.push((i - start) as u32);
                start = i + 1;
            }
        }
        if start <= dataset.len() {
            records.push(start as u32);
            records.push((dataset.len() - start) as u32);
        }

        SearchEngine {
            results: Vec::with_capacity(records.len() / 2),
            dataset,
            records,
        }
    }

    pub fn search(&mut self, query: &str, max_distance: usize) -> *const u32 {
        self.results.clear();
        let query_bytes = query.as_bytes();
        if query_bytes.is_empty() {
            return self.results.as_ptr();
        }

        let num_records = self.records.len() / 2;
        for i in 0..num_records {
            let start = self.records[i * 2] as usize;
            let len = self.records[i * 2 + 1] as usize;
            let target = &self.dataset[start..start + len];
            
            if levenshtein_substring(query_bytes, target, max_distance) {
                self.results.push(i as u32);
            }
        }
        
        self.results.as_ptr()
    }

    pub fn result_len(&self) -> usize {
        self.results.len()
    }
}

fn levenshtein_substring(query: &[u8], target: &[u8], max_distance: usize) -> bool {
    if query.is_empty() { return true; }
    if target.len() + max_distance < query.len() { return false; }
    
    let m = query.len();
    let n = target.len();
    
    let mut dp = vec![0; m + 1];
    for i in 0..=m {
        dp[i] = i;
    }
    
    let mut min_dist = m;
    
    for j in 1..=n {
        let mut prev = dp[0];
        dp[0] = 0; 
        
        let mut col_min = dp[0];
        
        for i in 1..=m {
            let temp = dp[i];
            let cost = if query[i-1].to_ascii_lowercase() == target[j-1].to_ascii_lowercase() { 0 } else { 1 };
            
            dp[i] = std::cmp::min(
                std::cmp::min(dp[i-1] + 1, dp[i] + 1),
                prev + cost
            );
            col_min = std::cmp::min(col_min, dp[i]);
            prev = temp;
        }
        
        if dp[m] < min_dist {
            min_dist = dp[m];
        }
        if min_dist <= max_distance {
            return true;
        }
        
        if col_min > max_distance {
            // Early exit if the entire column is greater than max_distance
            // wait, we can't early exit on col_min because dp[0] is always 0.
            // dp[0] is 0, so col_min is always 0. 
        }
    }
    
    min_dist <= max_distance
}
