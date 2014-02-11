/**
 * @author mikael emtinger / http://gomo.se/
 * @author mrdoob / http://mrdoob.com/
 * @author alteredq / http://alteredqualia.com/
 */

THREE.Animation = function ( root, name ) {

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

	this.interpolationType = THREE.AnimationHandler.LINEAR;

	this.points = [];
	this.animationCaches = {};
	this.target = new THREE.Vector3();

};

THREE.Animation.prototype.play = function ( startTimeMS, weight, fadeInTime ) {

	if ( this.isPlaying === false ) {

		this.isPlaying = true;
		this.isFadingOut = false;
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

		this.currentTime = 0;
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

		if ( this.animationCaches[ h ] === undefined ) {

			var animationCache = this.animationCaches[ h ] = {};
			animationCache.prevKey = { pos: 0, rot: 0, scl: 0 };
			animationCache.nextKey = { pos: 0, rot: 0, scl: 0 };
			animationCache.originalMatrix = object instanceof THREE.Bone ? object.skinMatrix : object.matrix;

		}

		var prevKey = this.animationCaches[ h ].prevKey;
		var nextKey = this.animationCaches[ h ].nextKey;

		prevKey.pos = this.data.hierarchy[ h ].keys[ 0 ];
		prevKey.rot = this.data.hierarchy[ h ].keys[ 0 ];
		prevKey.scl = this.data.hierarchy[ h ].keys[ 0 ];

		nextKey.pos = this.getNextKeyWith( "pos", h, 1 );
		nextKey.rot = this.getNextKeyWith( "rot", h, 1 );
		nextKey.scl = this.getNextKeyWith( "scl", h, 1 );

	}

};


THREE.Animation.prototype.update = function ( delta ) {

	if ( this.isPlaying === false ) return;

	this.currentTime += delta * this.timeScale;

	var vector;
	var quat;
	var proportionalWeight;
	var types = [ "pos", "rot", "scl" ];

	var duration = this.data.length;
	
	var fadedWeight = 1;
	this.fadeTimeElapsed += delta * this.timeScale;

	// Scale the weight based on fade in/out
	
	if (this.fadeInTime > 0 || this.fadeOutTime > 0) {
		
        if (this.isFadingOut) {
            
            fadedWeight = Math.max( 1 - this.fadeTimeElapsed / this.fadeOutTime, 0 );
            
            if (fadedWeight === 0)
            {
                this.fadeOutTime = 0;
                this.stop(0);
            }

        }
        else {
		
            fadedWeight = Math.min( this.fadeTimeElapsed / this.fadeInTime, 1 );
			
            if (fadedWeight === 1)
                this.fadeInTime = 0;
				
        }
			
    }
	
	fadedWeight = fadedWeight === 0 ? 0 : this.weight * fadedWeight;
	
	// To make sure that we don't divide by zero while interpolating
	
	if ( fadedWeight === 0 )
            return;

	if ( this.loop === true && this.currentTime > duration ) {

		this.currentTime %= duration;
		this.reset();

	}

	this.currentTime = Math.min( this.currentTime, duration );

	for ( var h = 0, hl = this.hierarchy.length; h < hl; h ++ ) {

		var object = this.hierarchy[ h ];
		var animationCache = this.animationCaches[ h ];

		// loop through pos/rot/scl

		for ( var t = 0; t < 3; t ++ ) {

			// get keys

			var type    = types[ t ];
			var prevKey = animationCache.prevKey[ type ];
			var nextKey = animationCache.nextKey[ type ];

			if ( nextKey.time <= this.currentTime ) {

				prevKey = this.data.hierarchy[ h ].keys[ 0 ];
				nextKey = this.getNextKeyWith( type, h, 1 );

				while ( nextKey.time < this.currentTime && nextKey.index > prevKey.index ) {

					prevKey = nextKey;
					nextKey = this.getNextKeyWith( type, h, nextKey.index + 1 );

				}

				animationCache.prevKey[ type ] = prevKey;
				animationCache.nextKey[ type ] = nextKey;

			}

			object.matrixAutoUpdate = true;
			object.matrixWorldNeedsUpdate = true;

			var scale = ( this.currentTime - prevKey.time ) / ( nextKey.time - prevKey.time );

			var prevXYZ = prevKey[ type ];
			var nextXYZ = nextKey[ type ];

			scale = Math.min(Math.max(scale, 0), 1);

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

					// If first animation to blend to a bone, reset position to bind pose
					if (object instanceof THREE.Bone) {

						if (object.accumulatedPosWeight === 0) {
							vector.copy(object.originalPosition);
							proportionalWeight = fadedWeight;
						}
						else
							proportionalWeight = fadedWeight / ( fadedWeight + object.accumulatedPosWeight );

						vector.lerp(newVector, proportionalWeight);
						object.accumulatedPosWeight += fadedWeight;

					} else
						vector.copy(newVector);


				} else if ( this.interpolationType === THREE.AnimationHandler.CATMULLROM ||
					this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD ) {

					this.points[ 0 ] = this.getPrevKeyWith( "pos", h, prevKey.index - 1 )[ "pos" ];
					this.points[ 1 ] = prevXYZ;
					this.points[ 2 ] = nextXYZ;
					this.points[ 3 ] = this.getNextKeyWith( "pos", h, nextKey.index + 1 )[ "pos" ];

					scale = scale * 0.33 + 0.33;

					var currentPoint = this.interpolateCatmullRom( this.points, scale );

					// If first animation to blend to a bone, reset position to bind pose
					if ( object instanceof THREE.Bone ) {

						if (object.accumulatedPosWeight === 0) {
							vector.copy(object.originalPosition);
							proportionalWeight = fadedWeight;
						}
						else
							proportionalWeight = fadedWeight / ( fadedWeight + object.accumulatedPosWeight );

						object.accumulatedPosWeight += fadedWeight

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

				quat = object.quaternion;

				var newRotation = new THREE.Quaternion();
				THREE.Quaternion.slerp( prevXYZ, nextXYZ, newRotation, scale );

				// If first animation to blend to a bone, reset rotation to bind pose
				if (object instanceof THREE.Bone) {

					if (object.accumulatedRotWeight === 0) {
						quat.copy(object.originalQuaternion);
						proportionalWeight = fadedWeight;
					}
					else
						proportionalWeight = fadedWeight / ( fadedWeight + object.accumulatedRotWeight );

					quat.slerp(newRotation, proportionalWeight);
					object.accumulatedRotWeight += fadedWeight;

				}
				else
					quat.copy(newRotation);

			} else if ( type === "scl" ) {

				vector = object.scale;

				var newScale = new THREE.Vector3(
					prevXYZ[ 0 ] + ( nextXYZ[ 0 ] - prevXYZ[ 0 ] ) * scale,
					prevXYZ[ 1 ] + ( nextXYZ[ 1 ] - prevXYZ[ 1 ] ) * scale,
					prevXYZ[ 2 ] + ( nextXYZ[ 2 ] - prevXYZ[ 2 ] ) * scale
				);

				// If first animation to blend to a bone, reset scale to bind pose
				if ( object instanceof THREE.Bone ) {

					if (object.accumulatedSclWeight === 0) {
						vector.copy(object.originalScale);
						proportionalWeight = fadedWeight;
					}
					else
						proportionalWeight = fadedWeight / ( fadedWeight + object.accumulatedSclWeight );

					vector.lerp(newScale, proportionalWeight);
					object.accumulatedSclWeight += fadedWeight;

				} else
					vector.copy(newScale);

			}

		}

	}

	if ( this.loop === false && this.currentTime >= duration ) {

		this.stop(0);

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
