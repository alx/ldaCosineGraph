var path = require('path');
var fs = require('fs');
var lda = require('lda');
var nlp = require('wink-nlp-utils');
var cosine = require('wink-distance').bow.cosine;
var csv = require('fast-csv');

function ldaTweets() {

  var tweets = [];
  var options = {
    nb_topics: 12,
    nb_terms: 20,
    min_weight: 0.9,
    output_file: 'tweets.json'
  };

  var stream = fs.createReadStream(path.resolve("./reports", "tweets.csv"))
    .pipe(csv.parse({headers: true}))
    .transform(function (row) {
      return {id: parseInt(row.id), text: row.text};
    })
    .on("readable", function () {
      var row;
      while (null !== (row = stream.read())) {
        //console.log(row);
        if(row.id && row.id > 0 && row.text && row.text.length > 0) {
          tweets.push(row);
        }
      }
    })
    .on("end", function() {
      console.log("ldaToGraph: " + tweets.length);
      options.labels = tweets.map(t => t.text);
      options.metadata = tweets.map(t => {return {tweet_id: t.id};});
      ldaToGraph(tweets.map(t => t.text), options);
    });
}

ldaTweets();

/**
 * Promise all
 * @author Loreto Parisi (loretoparisi at gmail dot com)
 */
function promiseAllP(items, block) {
    var promises = [];
    items.forEach(function(item,index) {
        promises.push( function(item,i) {
            return new Promise(function(resolve, reject) {
                return block.apply(this,[item,index,resolve,reject]);
            });
        }(item,index))
    });
    return Promise.all(promises);
} //promiseAll

/**
 * read files
 * @param dirname string
 * @return Promise
 * @author Loreto Parisi (loretoparisi at gmail dot com)
 * @see http://stackoverflow.com/questions/10049557/reading-all-files-in-a-directory-store-them-in-objects-and-send-the-object
 */
function readFiles(dirname) {
    return new Promise((resolve, reject) => {
        fs.readdir(dirname, function(err, filenames) {
            if (err) return reject(err);
            promiseAllP(filenames,
            (filename,index,resolve,reject) =>  {
                fs.readFile(path.resolve(dirname, filename), 'utf-8', function(err, content) {
                    if (err) return reject(err);
                    const tokens = nlp.string.tokenize(content);
                    const stems = nlp.tokens.stem(tokens);
                    return resolve({filename: filename, contents: stems.join(' ')});
                });
            })
            .then(results => {
                return resolve(results);
            })
            .catch(error => {
                return reject(error);
            });
        });
  });
}

function ldaToGraph(content, options) {
  var ldaResults = lda(content, options.nb_topics, options.nb_terms);
  console.log('lda result available');
  console.log(ldaResults.result);
  var graph = {
    nodes: ldaResults.theta.map((theta, index) => {
      //console.log(files[index].filename);

      let size = 1;
      if(content[index].length > 0)
        size = content[index].length;

      let metadata = {};
      if(options.metadata[index]) {
        metadata = options.metadata[index];
      }
      metadata.theta = theta;

      return {
        id: 'n' + index,
        label: options.labels[index],
        x: Math.random(),
        y: Math.random(),
        size: size,
        metadata: metadata
      };
    }),
    edges: [],
    topics: ldaResults.result
  }

  let cosineNodes = graph.nodes;
  let edge_id = 0;

  console.log('write node output');

  fs.writeFile('nodes_' + options.output_file, JSON.stringify(graph, null, 2), (err) => {
    if (err){
      console.log(err);
      throw err;
    }
    console.log('nodes_' + options.output_file + ' done');
  })

  console.log('begin cosine similarity');

  graph.nodes.forEach(nodeA => {

    // Remove node on each pass
    cosineNodes = cosineNodes.filter(nodeB => nodeA.id != nodeB.id);

    cosineNodes.forEach(nodeB => {

      const weight = cosine(
        nodeA.metadata.theta.reduce(function(result, theta, index) {
          result['topic' + index] = theta;
          return result;
        }, {}),
        nodeB.metadata.theta.reduce(function(result, theta, index) {
          result['topic' + index] = theta;
          return result;
        }, {})
      );


      if(weight > options.min_weight) {
        edge_id += 1;
        graph.edges.push({
          id: 'e' + edge_id,
          source: nodeA.id,
          target: nodeB.id,
          weight: weight,
        });
      }

    });

  });

  fs.writeFile(options.output_file, JSON.stringify(graph, null, 2), (err) => {
    if (err){
      console.log(err);
      throw err;
    }
    console.log(options.output_file + ' done');
  })
}

function buildGraph(product_name) {

  const report_folder = 'reports/' + product_name;
  const nb_topics = 5;
  const nb_terms = 20;
  // set to -1 to output all edges
  const min_weight = -1;
  const output_file = 'output/' + product_name + '.json';

  readFiles( report_folder )
  .then(files => {

    console.log( product_name + " - " + files.length  + " files loaded" );

    const fileContent = files.filter(item => item.contents.length > 0).map(item => item.contents);
    var ldaResults = lda(fileContent, nb_topics, nb_terms);
    var graph = {
      nodes: ldaResults.theta.map((theta, index) => {
        //console.log(files[index].filename);

        let size = 1;
        if(files[index].contents.length > 0)
          size = files[index].contents.length;

        return {
          id: 'n' + index,
          label: files[index].filename,
          x: Math.random(),
          y: Math.random(),
          size: size,
          metadata: {
            theta: theta,
          },
        };
      }),
      edges: [],
      topics: ldaResults.result
    }

    let cosineNodes = graph.nodes;
    let edge_id = 0;

    graph.nodes.forEach(nodeA => {

      // Remove node on each pass
      cosineNodes = cosineNodes.filter(nodeB => nodeA.id != nodeB.id);

      cosineNodes.forEach(nodeB => {

        const weight = cosine(
          nodeA.metadata.theta.reduce(function(result, theta, index) {
            result['topic' + index] = theta;
            return result;
          }, {}),
          nodeB.metadata.theta.reduce(function(result, theta, index) {
            result['topic' + index] = theta;
            return result;
          }, {})
        );


        if(weight > min_weight) {
          edge_id += 1;
          graph.edges.push({
            id: 'e' + edge_id,
            source: nodeA.id,
            target: nodeB.id,
            weight: weight,
          });
        }

      });

    });
    //console.log(graph);

    fs.writeFile(output_file, JSON.stringify(graph, null, 2), (err) => {
      if (err){
        console.log(err);
        throw err;
      }
      console.log(product_name + ' done');
    })
  })
  .catch( error => {
      console.log( error );
  });

}

//buildGraph(process.argv[2]);
