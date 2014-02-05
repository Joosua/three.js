/**
 * @author mikael emtinger / http://gomo.se/
 * @author mrdoob / http://mrdoob.com/
 * @author alteredq / http://alteredqualia.com/
 */

THREE.Animation = function ( root, name, interpolationType ) {

	this.root = root;
	this.data = THREE.AnimationHandler.get( name );
	this.hierarchy = THREE.AnimationHandler.parse( root );

	this.currentTime = 0;
	this.timeScale = 1;

	this.isPlaying = false;
	this.isPaused = true;
	this.isFadingOut = false;
	this.loop = true;
	this.weight = 1;
	this.fadeInTime = 0;
	this.fadeOutTime = 0;
	this.fadeTimeElapsed = 0;

	this.interpolationType = interpolationType !== undefined ? interpolationType : THREE.AnimationHandler.LINEAR;

	this.points = [];
	this.target = new THREE.Vector3();

};

THREE.Animation.prototype.play = function ( startTime ) {

THREE.Animation.prototype.play = function ( startTimeMS, weight, fadeInTime ) {

	if ( this.isPlaying === false ) {

		this.isPlaying = true;
		this.isFadingOut = false;
		this.loop = loop !== undefined ? loop : true;
		this.weight = weight !== undefined ? weight: 1;
		this.fadeInTime = fadeInTime !== undefined ? fadeInTime: 0;
		this.fadeTimeElapsed = 0;

		this.reset();
		this.update( 0 );

	}

	this.isPaused = false;

	THREE.AnimationHandler.addToUpdate( this );

};


THREE.Animation.prototype.pause = function() {

	if ( this.isPaused === true ) {

		THREE.AnimationHandler.addToUpdate( this );

	} else {

		THREE.AnimationHandler.removeFromUpdate( this );

	}

	this.isPaused = !this.isPaused;

};


THREE.Animation.prototype.stop = function(fadeOutTime) {

	fadeOutTime = fadeOutTime !== undefined ? fadeOutTime: 0;

	if ( fadeOutTime === 0 ) {

		this.isPlaying = false;
		this.isPaused  = false;
		THREE.AnimationHandler.removeFromUpdate( this );

	} else {

		this.isFadingOut = true;
		this.fadeTimeElapsed = 0;
		this.fadeOutTime = fadeOutTime;

	}

};

THREE.Animation.prototype.reset = function () {

	for ( var h = 0, hl = this.hierarchy.length; h < hl; h ++ ) {

		var object = this.hierarchy[ h ];

		object.matrixAutoUpdate = true;

		if ( object.animationCache === undefined ) {

			object.animationCache = {};
			object.animationCache.prevKey = { pos: 0, rot: 0, scl: 0 };
			object.animationCache.nextKey = { pos: 0, rot: 0, scl: 0 };
			object.animationCache.originalMatrix = object instanceof THREE.Bone ? object.skinMatrix : object.matrix;

		}
	var fadedWeight;

		var prevKey = object.animationCache.prevKey;
		var nextKey = object.animationCache.nextKey;

		prevKey.pos = this.data.hierarchy[ h ].keys[ 0 ];
		prevKey.rot = this.data.hierarchy[ h ].keys[ 0 ];
		prevKey.scl = this.data.hierarchy[ h ].keys[ 0 ];
	this.fadeTimeElapsed += deltaTimeMS * this.timeScale;

		nextKey.pos = this.getNextKeyWith( "pos", h, 1 );
		nextKey.rot = this.getNextKeyWith( "rot", h, 1 );
		nextKey.scl = this.getNextKeyWith( "scl", h, 1 );
	// Scale the weight based on fade in/out
	if (this.isFadingOut) {

			fadedWeight = this.weight * Math.max( 1 - this.fadeTimeElapsed / this.fadeOutTime, 0 );
			if ( fadedWeight === 0 ) {

				this.stop(0);
				return;

			}

	} else {

		if ( this.fadeInTime !== 0 )
			fadedWeight = this.weight * Math.min( this.fadeTimeElapsed / this.fadeInTime, 1 );
		else
			fadedWeight = this.weight;

		if ( fadedWeight === 0 )
			return;
	}

	unloopedCurrentTime = this.currentTime;
	currentTime = this.currentTime = this.currentTime % this.data.length;
	frame = parseInt( Math.min( currentTime * this.data.fps, this.data.length * this.data.fps ), 10 );

	}

};


THREE.Animation.prototype.update = function ( delta ) {

	if ( this.isPlaying === false ) return;

	this.currentTime += delta * this.timeScale;

	//

	var vector;
	var types = [ "pos", "rot", "scl" ];

	var duration = this.data.length;
	var currentTime = this.currentTime;

	if ( this.loop === true ) {

		currentTime %= duration;

	}

	currentTime = Math.min( currentTime, duration );

	for ( var h = 0, hl = this.hierarchy.length; h < hl; h ++ ) {

		var object = this.hierarchy[ h ];
		var animationCache = object.animationCache;

		// loop through pos/rot/scl

		for ( var t = 0; t < 3; t ++ ) {

			// get keys

			var type    = types[ t ];
			var prevKey = animationCache.prevKey[ type ];
			var nextKey = animationCache.nextKey[ type ];

			if ( nextKey.time <= currentTime ) {

				prevKey = this.data.hierarchy[ h ].keys[ 0 ];
				nextKey = this.getNextKeyWith( type, h, 1 );

				while ( nextKey.time < currentTime && nextKey.index > prevKey.index ) {

					prevKey = nextKey;
					nextKey = this.getNextKeyWith( type, h, nextKey.index + 1 );

				}

				animationCache.prevKey[ type ] = prevKey;
				animationCache.nextKey[ type ] = nextKey;

			}

			object.matrixAutoUpdate = true;
			object.matrixWorldNeedsUpdate = true;

			var scale = ( currentTime - prevKey.time ) / ( nextKey.time - prevKey.time );

			var prevXYZ = prevKey[ type ];
			var nextXYZ = nextKey[ type ];

			if ( scale < 0 ) scale = 0;
			if ( scale > 1 ) scale = 1;

			// interpolate

			if ( type === "pos" ) {

				vector = object.position;

				if ( this.interpolationType === THREE.AnimationHandler.LINEAR ) {

					// get the lerped keyframe
					var newVector = new THREE.Vector3(
						prevXYZ[ 0 ] + ( nextXYZ[ 0 ] - prevXYZ[ 0 ] ) * scale,
						prevXYZ[ 1 ] + ( nextXYZ[ 1 ] - prevXYZ[ 1 ] ) * scale,
						prevXYZ[ 2 ] + ( nextXYZ[ 2 ] - prevXYZ[ 2 ] ) * scale
					);

					// blend this pos animation with others
					if (object instanceof THREE.Bone) {
						var proportionalWeight = fadedWeight / ( fadedWeight + object.accumulatedPosWeight );
						vector.lerp( newVector, proportionalWeight );
						object.accumulatedPosWeight += fadedWeight;
					} else
						vector = newVector;


				} else if ( this.interpolationType === THREE.AnimationHandler.CATMULLROM ||
					this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD ) {

					this.points[ 0 ] = this.getPrevKeyWith( "pos", h, prevKey.index - 1 )[ "pos" ];
					this.points[ 1 ] = prevXYZ;
					this.points[ 2 ] = nextXYZ;
					this.points[ 3 ] = this.getNextKeyWith( "pos", h, nextKey.index + 1 )[ "pos" ];

					scale = scale * 0.33 + 0.33;

					var currentPoint = this.interpolateCatmullRom( this.points, scale );

					if ( object instanceof THREE.Bone ) {
						var proportionalWeight = fadedWeight / ( fadedWeight + object.accumulatedPosWeight );
						object.accumulatedPosWeight += fadedWeight;
					}
					else
						var proportionalWeight = 1;

					vector.x = vector.x + ( currentPoint[ 0 ] - vector.x ) * proportionalWeight;
					vector.y = vector.y + ( currentPoint[ 1 ] - vector.y ) * proportionalWeight;
					vector.z = vector.z + ( currentPoint[ 2 ] - vector.z ) * proportionalWeight;

					if ( this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD ) {

						var forwardPoint = this.interpolateCatmullRom( this.points, scale * 1.01 );

						this.target.set( forwardPoint[ 0 ], forwardPoint[ 1 ], forwardPoint[ 2 ] );
						this.target.sub( vector );
						this.target.y = 0;
						this.target.normalize();

						var angle = Math.atan2( this.target.x, this.target.z );
						object.rotation.set( 0, angle, 0 );

					}

				}

			} else if ( type === "rot" ) {

				var newRotation = new THREE.Quaternion();
				THREE.Quaternion.slerp( prevXYZ, nextXYZ, newRotation, scale );

				if ( !( object instanceof THREE.Bone) ) {

					object.quaternion = newRotation;

				}
				// Avoid paying the cost of slerp if we don't have to
				else if ( object.accumulateRotWeight === 0) {

					object.quaternion = newRotation;
					object.accumulatedRotWeight = fadedWeight;

				}
				else {

					var proportionalWeight = fadedWeight / (fadedWeight + object.accumulatedRotWeight);
					THREE.Quaternion.slerp( object.quaternion, newRotation, object.quaternion, proportionalWeight );
					object.accumulatedRotWeight += fadedWeight;

				}

			} else if ( type === "scl" ) {

				vector = object.scale;

				var newScale = new THREE.Vector3(
					prevXYZ[ 0 ] + ( nextXYZ[ 0 ] - prevXYZ[ 0 ] ) * scale,
					prevXYZ[ 1 ] + ( nextXYZ[ 1 ] - prevXYZ[ 1 ] ) * scale,
					prevXYZ[ 2 ] + ( nextXYZ[ 2 ] - prevXYZ[ 2 ] ) * scale
				);

				if ( object instanceof THREE.Bone ) {

					var proportionalWeight = fadedWeight / ( fadedWeight + object.accumulatedSclWeight);
					vector.lerp( newScale, proportionalWeight );
					object.accumulatedSclWeight += fadedWeight;

				} else
					vector = newScale;

			}

		}

	}

	if ( this.currentTime > duration ) {

		this.reset();

		if ( this.loop === false ) {

			this.stop();

		}

	}

};

// Catmull-Rom spline

THREE.Animation.prototype.interpolateCatmullRom = function ( points, scale ) {

	var c = [], v3 = [],
	point, intPoint, weight, w2, w3,
	pa, pb, pc, pd;

	point = ( points.length - 1 ) * scale;
	intPoint = Math.floor( point );
	weight = point - intPoint;

	c[ 0 ] = intPoint === 0 ? intPoint : intPoint - 1;
	c[ 1 ] = intPoint;
	c[ 2 ] = intPoint > points.length - 2 ? intPoint : intPoint + 1;
	c[ 3 ] = intPoint > points.length - 3 ? intPoint : intPoint + 2;

	pa = points[ c[ 0 ] ];
	pb = points[ c[ 1 ] ];
	pc = points[ c[ 2 ] ];
	pd = points[ c[ 3 ] ];

	w2 = weight * weight;
	w3 = weight * w2;

	v3[ 0 ] = this.interpolate( pa[ 0 ], pb[ 0 ], pc[ 0 ], pd[ 0 ], weight, w2, w3 );
	v3[ 1 ] = this.interpolate( pa[ 1 ], pb[ 1 ], pc[ 1 ], pd[ 1 ], weight, w2, w3 );
	v3[ 2 ] = this.interpolate( pa[ 2 ], pb[ 2 ], pc[ 2 ], pd[ 2 ], weight, w2, w3 );

	return v3;

};

THREE.Animation.prototype.interpolate = function ( p0, p1, p2, p3, t, t2, t3 ) {

	var v0 = ( p2 - p0 ) * 0.5,
		v1 = ( p3 - p1 ) * 0.5;

	return ( 2 * ( p1 - p2 ) + v0 + v1 ) * t3 + ( - 3 * ( p1 - p2 ) - 2 * v0 - v1 ) * t2 + v0 * t + p1;

};



// Get next key with

THREE.Animation.prototype.getNextKeyWith = function ( type, h, key ) {

	var keys = this.data.hierarchy[ h ].keys;

	if ( this.interpolationType === THREE.AnimationHandler.CATMULLROM ||
		 this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD ) {

		key = key < keys.length - 1 ? key : keys.length - 1;

	} else {

		key = key % keys.length;

	}

	for ( ; key < keys.length; key++ ) {

		if ( keys[ key ][ type ] !== undefined ) {

			return keys[ key ];

		}

	}

	return this.data.hierarchy[ h ].keys[ 0 ];

};

// Get previous key with

THREE.Animation.prototype.getPrevKeyWith = function ( type, h, key ) {

	var keys = this.data.hierarchy[ h ].keys;

	if ( this.interpolationType === THREE.AnimationHandler.CATMULLROM ||
		this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD ) {

		key = key > 0 ? key : 0;

	} else {

		key = key >= 0 ? key : key + keys.length;

	}


	for ( ; key >= 0; key -- ) {

		if ( keys[ key ][ type ] !== undefined ) {

			return keys[ key ];

		}

	}

	return this.data.hierarchy[ h ].keys[ keys.length - 1 ];

};
